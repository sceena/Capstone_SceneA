from __future__ import annotations

import os
import re
import struct
import wave
from functools import lru_cache
from pathlib import Path
from typing import Any


MIN_SILENCE_LEN_MS = 3000
SILENCE_THRESH_DBFS = -40
SILENCE_FRAME_MS = 100
MIN_ACCEPTABLE_CPM = 200
MAX_ACCEPTABLE_CPM = 350
MAX_NORMAL_SENTENCE_WORDS = 20
VERBOSE_SENTENCE_WORDS = 25
VERBOSE_SENTENCE_RATIO = 0.3
CPM_CENTER = (MIN_ACCEPTABLE_CPM + MAX_ACCEPTABLE_CPM) / 2

STRUCTURE_ELEMENTS_BY_TYPE = {
    "experience": ["situation", "task", "action", "result"],
    "opinion": ["claim", "reason", "example"],
    "situational": ["situation_understanding", "action_plan", "rationale"],
    "knowledge": ["concept", "explanation", "example"],
}
DEFAULT_STRUCTURE_TYPE = "opinion"


@lru_cache(maxsize=4)
def _load_whisper_model(model_size: str):
    import whisper

    download_root = os.environ.get("WHISPER_CACHE_DIR")
    return whisper.load_model(model_size, download_root=download_root)


def analyze_single_audio(
    audio_path: str,
    model_size: str = "base",
    need_metrics: bool = True,
) -> dict[str, Any]:
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"audio file not found: {audio_path}")

    model = _load_whisper_model(model_size)
    result = model.transcribe(str(path), word_timestamps=need_metrics)
    text = (result.get("text") or "").strip()

    if not need_metrics:
        return {"text": text}

    duration, dead_air_count = _analyze_wav_silence(path)
    word_count = _count_words(result)
    wpm = _calculate_wpm(word_count, duration)
    cpm = _calculate_cpm(text, duration)
    sentence_conciseness = _analyze_sentence_conciseness(text)
    structure_analysis = _fallback_structure_analysis(text)
    selection_score = _calculate_selection_score(cpm, dead_air_count, sentence_conciseness, structure_analysis)

    return {
        "text": text,
        "cpm": cpm,
        "wpm": wpm,
        "dead_air_count": dead_air_count,
        "word_count": word_count,
        "duration": round(duration, 2),
        "sentence_conciseness": sentence_conciseness,
        "structure_analysis": structure_analysis,
        "selection_score": selection_score,
    }


def get_interview_summary(
    interview_sessions_dict: dict[str, dict[str, str]],
    model_size: str = "base",
    use_llm_top_summary: bool = True,
) -> dict[str, Any]:
    summary: dict[str, Any] = {}

    for session_no, audio_pair in interview_sessions_dict.items():
        question = analyze_single_audio(
            audio_pair["question_audio"],
            model_size=model_size,
            need_metrics=False,
        )
        answer = analyze_single_audio(
            audio_pair["answer_audio"],
            model_size=model_size,
            need_metrics=True,
        )

        summary[session_no] = {
            "question_text": question["text"],
            "answer_text": answer["text"],
            "cpm": answer["cpm"],
            "wpm": answer["wpm"],
            "dead_air_count": answer["dead_air_count"],
            "word_count": answer["word_count"],
            "duration": answer["duration"],
            "sentence_conciseness": answer["sentence_conciseness"],
            "structure_analysis": answer["structure_analysis"],
            "selection_score": answer["selection_score"],
        }

    if use_llm_top_summary:
        summary = _apply_llm_structure_analysis(summary)

    _apply_best_worst(summary)
    return summary


def _apply_llm_structure_analysis(summary: dict[str, Any]) -> dict[str, Any]:
    try:
        from app.services.top_summary_composer import (
            TopSummaryComposer,
            TopSummaryComposerUnavailable,
        )

        llm_result = TopSummaryComposer().generate(summary)
    except (TopSummaryComposerUnavailable, ValueError):
        summary["top_summary_source"] = "fallback"
        return summary

    for item in llm_result.structure_analysis:
        session = summary.get(item.session_id)
        if not isinstance(session, dict):
            continue

        structure_analysis = _normalize_structure_analysis(item.model_dump())
        session["structure_analysis"] = structure_analysis
        session["selection_score"] = _calculate_selection_score(
            session["cpm"],
            session["dead_air_count"],
            session["sentence_conciseness"],
            structure_analysis,
        )

    summary["top_summary_source"] = "llm"
    return summary


def _apply_best_worst(summary: dict[str, Any]) -> None:
    ranked_sessions = sorted(
        (
            (session_no, session_result)
            for session_no, session_result in summary.items()
            if session_no.startswith("Session") and isinstance(session_result, dict)
        ),
        key=lambda item: _rank_key(item[1]),
        reverse=True,
    )

    summary["best_question"] = ranked_sessions[0][0] if ranked_sessions else None
    summary["worst_question"] = ranked_sessions[-1][0] if ranked_sessions else None

    if ranked_sessions:
        summary["best_selection_metrics"] = _build_selection_metrics(ranked_sessions[0][1])
        summary["worst_selection_metrics"] = _build_selection_metrics(ranked_sessions[-1][1])

    summary.setdefault("top_summary_source", "fallback")


def _rank_key(session: dict[str, Any]) -> tuple[int, int, int, float, float]:
    return (
        session["selection_score"],
        _structure_presence_count(session["structure_analysis"]),
        -session["dead_air_count"],
        -abs(_cpm_distance_from_normal(session["cpm"])),
        -session["sentence_conciseness"]["verbose_sentence_ratio"],
    )


def _build_selection_metrics(session: dict[str, Any]) -> dict[str, Any]:
    structure_analysis = session["structure_analysis"]
    sentence_conciseness = session["sentence_conciseness"]

    return {
        "selection_score": session["selection_score"],
        "question_type": structure_analysis["question_type"],
        "missing_elements": structure_analysis["missing_elements"],
        "present_elements": structure_analysis["present_elements"],
        "structure_completed": structure_analysis["structure_completed"],
        "dead_air_count": session["dead_air_count"],
        "cpm": session["cpm"],
        "cpm_distance_from_center": round(abs(session["cpm"] - CPM_CENTER), 1),
        "cpm_in_acceptable_range": MIN_ACCEPTABLE_CPM <= session["cpm"] <= MAX_ACCEPTABLE_CPM,
        "sentence_conciseness": sentence_conciseness["label"],
        "verbose_sentence_ratio": sentence_conciseness["verbose_sentence_ratio"],
    }


def _calculate_selection_score(
    cpm: float,
    dead_air_count: int,
    sentence_conciseness: dict[str, Any],
    structure_analysis: dict[str, Any],
) -> int:
    score = 100
    score -= dead_air_count * 15

    if cpm < MIN_ACCEPTABLE_CPM or cpm > MAX_ACCEPTABLE_CPM:
        score -= 20

    if sentence_conciseness["is_verbose"]:
        score -= 15

    score -= len(structure_analysis["missing_elements"]) * 10
    return max(0, min(100, score))


def _normalize_structure_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    question_type = analysis.get("question_type") or DEFAULT_STRUCTURE_TYPE
    if question_type not in STRUCTURE_ELEMENTS_BY_TYPE:
        question_type = DEFAULT_STRUCTURE_TYPE

    expected = STRUCTURE_ELEMENTS_BY_TYPE[question_type]
    raw_elements = analysis.get("elements") or {}
    elements = {key: bool(raw_elements.get(key)) for key in expected}

    missing_elements = [key for key in expected if not elements[key]]
    present_elements = [key for key in expected if elements[key]]

    return {
        "question_type": question_type,
        "elements": elements,
        "reason": analysis.get("reason") or "",
        "missing_elements": missing_elements,
        "present_elements": present_elements,
        "structure_completed": not missing_elements,
    }


def _structure_presence_count(analysis: dict[str, Any]) -> int:
    return len(analysis["present_elements"])


def _fallback_structure_analysis(text: str) -> dict[str, Any]:
    return _normalize_structure_analysis(
        {
            "question_type": "experience",
            "elements": {
                "situation": _matches_any(text, [r"\d{4}년|작년|올해|당시|이전|최근", r"프로젝트|캡스톤|회사|학교|팀에서|소속|역할"]),
                "task": _matches_any(text, [r"문제|목표|과제|요구|필요|해야 했|해결해야", r"개선해야|병목|어려움|지연|장애|이슈"]),
                "action": bool(
                    re.search(r"제가|저는|저의|저에게|저도|저", text)
                    and re.search(
                        r"도입|적용|구현|설정|분석|개선|해결|작성|설계|튜닝|최적화|캐싱|인덱스|배포|테스트",
                        text,
                        re.IGNORECASE,
                    )
                ),
                "result": _matches_any(text, [r"\d+%|\d+배|\d+ms|\d+초|\d+분|\d+건", r"결과|성과|산출물|개선되|향상|감소|단축|증가|배웠|깨달|만족|완료"]),
            },
            "reason": "Fallback keyword-based structure analysis.",
        }
    )


def _count_words(transcription_result: dict[str, Any]) -> int:
    words = []
    for segment in transcription_result.get("segments", []):
        words.extend(segment.get("words") or [])

    if words:
        return len(words)

    text = (transcription_result.get("text") or "").strip()
    return len(text.split()) if text else 0


def _calculate_wpm(word_count: int, duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return 0.0
    return round(word_count / (duration_seconds / 60), 1)


def _calculate_cpm(text: str, duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return 0.0

    character_count = len(re.sub(r"\s+", "", text))
    return round(character_count / (duration_seconds / 60), 1)


def _cpm_distance_from_normal(cpm: float) -> float:
    if MIN_ACCEPTABLE_CPM <= cpm <= MAX_ACCEPTABLE_CPM:
        return 0.0
    if cpm < MIN_ACCEPTABLE_CPM:
        return MIN_ACCEPTABLE_CPM - cpm
    return cpm - MAX_ACCEPTABLE_CPM


def _analyze_sentence_conciseness(text: str) -> dict[str, Any]:
    sentences = _split_sentences(text)
    if not sentences:
        return {
            "sentence_count": 0,
            "average_words_per_sentence": 0.0,
            "verbose_sentence_ratio": 0.0,
            "is_verbose": False,
            "label": "not_measured",
        }

    word_counts = [len(sentence.split()) for sentence in sentences]
    verbose_count = sum(1 for count in word_counts if count > VERBOSE_SENTENCE_WORDS)
    average = round(sum(word_counts) / len(word_counts), 1)
    verbose_ratio = round(verbose_count / len(sentences), 2)
    is_verbose = verbose_ratio >= VERBOSE_SENTENCE_RATIO

    if is_verbose:
        label = "verbose"
    elif average < 15:
        label = "short"
    elif average <= MAX_NORMAL_SENTENCE_WORDS:
        label = "normal"
    else:
        label = "slightly_long"

    return {
        "sentence_count": len(sentences),
        "average_words_per_sentence": average,
        "verbose_sentence_ratio": verbose_ratio,
        "is_verbose": is_verbose,
        "label": label,
    }


def _split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+|(?<=다)\s+|(?<=요)\s+", normalized)
        if sentence.strip()
    ]
    return sentences or [normalized]


def _matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)


def _analyze_wav_silence(path: Path) -> tuple[float, int]:
    with wave.open(str(path), "rb") as wav:
        sample_width = wav.getsampwidth()
        frame_rate = wav.getframerate()
        total_frames = wav.getnframes()
        duration = total_frames / frame_rate if frame_rate else 0.0

        frames_per_chunk = max(1, int(frame_rate * SILENCE_FRAME_MS / 1000))
        min_silence_chunks = max(1, int(MIN_SILENCE_LEN_MS / SILENCE_FRAME_MS))
        max_possible = float(1 << (8 * sample_width - 1))

        silence_runs = 0
        current_silence_chunks = 0

        while True:
            frames = wav.readframes(frames_per_chunk)
            if not frames:
                break

            rms = _calculate_rms(frames, sample_width)
            dbfs = _rms_to_dbfs(rms, max_possible)

            if dbfs <= SILENCE_THRESH_DBFS:
                current_silence_chunks += 1
                continue

            if current_silence_chunks >= min_silence_chunks:
                silence_runs += 1
            current_silence_chunks = 0

        if current_silence_chunks >= min_silence_chunks:
            silence_runs += 1

    return round(duration, 2), silence_runs


def _calculate_rms(frames: bytes, sample_width: int) -> float:
    if not frames:
        return 0.0

    if sample_width == 1:
        samples = (sample - 128 for sample in frames)
    elif sample_width == 2:
        count = len(frames) // 2
        samples = struct.unpack(f"<{count}h", frames)
    elif sample_width == 4:
        count = len(frames) // 4
        samples = struct.unpack(f"<{count}i", frames)
    else:
        raise ValueError(f"unsupported WAV sample width: {sample_width}")

    total = 0.0
    sample_count = 0
    for sample in samples:
        total += sample * sample
        sample_count += 1

    if sample_count == 0:
        return 0.0

    return (total / sample_count) ** 0.5


def _rms_to_dbfs(rms: float, max_possible: float) -> float:
    if rms <= 0:
        return -100.0

    import math

    return 20 * math.log10(rms / max_possible)


if __name__ == "__main__":
    sample_sessions = {
        "Session1": {
            "question_audio": "q1.wav",
            "answer_audio": "a1.wav",
        },
        "Session2": {
            "question_audio": "q2.wav",
            "answer_audio": "a2.wav",
        },
    }

    summary = get_interview_summary(sample_sessions, model_size="base")
    print(summary)
