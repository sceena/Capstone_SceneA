from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO


class SttServiceUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class SttSegmentResult:
    start_sec: float
    end_sec: float
    text: str


@dataclass(frozen=True)
class SttResult:
    text: str
    model: str
    language: str | None
    duration_sec: int | None
    audio_quality_status: str
    audio_quality_message: str | None
    segments: list[SttSegmentResult]


@lru_cache(maxsize=2)
def _load_model(model_size: str, device: str, compute_type: str):
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SttServiceUnavailable(
            "faster-whisper is not installed. Install ai-server/requirements-model.txt."
        ) from exc

    download_root = os.environ.get("WHISPER_CACHE_DIR")
    return WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        download_root=download_root,
    )


class SttService:
    def __init__(self, model_size: str | None = None):
        self.model_size = model_size or os.environ.get("WHISPER_MODEL_SIZE", "medium")
        self.device = os.environ.get("WHISPER_DEVICE", "cpu")
        self.compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

    def transcribe(self, filename: str | None, audio_file: BinaryIO) -> SttResult:
        suffix = Path(filename or "answer.wav").suffix or ".wav"
        temp_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                temp.write(audio_file.read())
                temp_path = Path(temp.name)

            return self.transcribe_path(temp_path)
        except SttServiceUnavailable:
            raise
        except Exception as exc:
            raise SttServiceUnavailable("STT transcription failed") from exc
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)

    def transcribe_path(self, audio_path: Path) -> SttResult:
        with tempfile.TemporaryDirectory() as temp_dir:
            wav_path = Path(temp_dir) / "normalized.wav"
            self._convert_to_wav(audio_path, wav_path)

            quality_status, quality_message, measured_duration = self._inspect_audio(wav_path)
            if quality_status == "FAILED":
                raise SttServiceUnavailable(quality_message or "Audio quality check failed")

            model = _load_model(self.model_size, self.device, self.compute_type)
            segments, info = model.transcribe(
                str(wav_path),
                language="ko",
                task="transcribe",
                vad_filter=True,
            )

            segment_results: list[SttSegmentResult] = []
            text_parts: list[str] = []
            for segment in segments:
                text = segment.text.strip()
                if not text:
                    continue
                text_parts.append(text)
                segment_results.append(
                    SttSegmentResult(
                        start_sec=round(float(segment.start), 2),
                        end_sec=round(float(segment.end), 2),
                        text=text,
                    )
                )

            duration = getattr(info, "duration", None) or measured_duration
            duration_sec = int(round(duration)) if duration is not None else None

            return SttResult(
                text=" ".join(text_parts).strip(),
                model=f"faster-whisper-{self.model_size}",
                language=getattr(info, "language", None),
                duration_sec=duration_sec,
                audio_quality_status=quality_status,
                audio_quality_message=quality_message,
                segments=segment_results,
            )

    def _convert_to_wav(self, audio_path: Path, wav_path: Path) -> None:
        self._run_command(
            [
                "ffmpeg",
                "-nostdin",
                "-y",
                "-i",
                str(audio_path),
                "-ac",
                "1",
                "-ar",
                "16000",
                str(wav_path),
            ],
            "ffmpeg audio normalization failed",
        )

    def _inspect_audio(self, wav_path: Path) -> tuple[str, str | None, float | None]:
        duration = self._probe_duration(wav_path)
        if duration is not None and duration < 1.0:
            return "FAILED", "Audio is too short to transcribe.", duration

        mean_volume, max_volume = self._probe_volume(wav_path)
        warnings: list[str] = []

        if duration is not None and duration > 300:
            warnings.append("Audio is longer than the recommended 5 minute answer limit.")
        if mean_volume is not None and mean_volume < -45:
            warnings.append("Voice volume is low, so some words may be inaccurate.")
        if max_volume is not None and max_volume > -1:
            warnings.append("Audio may be clipped because the input volume is too high.")

        if warnings:
            return "WARNING", " ".join(warnings), duration
        return "OK", None, duration

    def _probe_duration(self, wav_path: Path) -> float | None:
        try:
            completed = self._run_command(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(wav_path),
                ],
                "ffprobe duration check failed",
            )
            return float(completed.stdout.strip())
        except Exception:
            return None

    def _probe_volume(self, wav_path: Path) -> tuple[float | None, float | None]:
        try:
            completed = self._run_command(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-i",
                    str(wav_path),
                    "-af",
                    "volumedetect",
                    "-f",
                    "null",
                    "-",
                ],
                "ffmpeg volume check failed",
            )
        except Exception:
            return None, None

        output = completed.stderr
        mean_match = re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB", output)
        max_match = re.search(r"max_volume:\s*(-?\d+(?:\.\d+)?) dB", output)
        mean_volume = float(mean_match.group(1)) if mean_match else None
        max_volume = float(max_match.group(1)) if max_match else None
        return mean_volume, max_volume

    def _run_command(self, command: list[str], message: str) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise SttServiceUnavailable("ffmpeg and ffprobe must be installed on the AI server.") from exc
        except subprocess.CalledProcessError as exc:
            detail = exc.stderr.strip() or exc.stdout.strip()
            raise SttServiceUnavailable(f"{message}: {detail}") from exc
