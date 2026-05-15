from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.report import (
    FitGap,
    MetricsSummary,
    QuestionHighlight,
    QuestionReport,
    Replay,
    ReportRequest,
    ReportResponse,
    TopSummary,
)


@dataclass(frozen=True)
class ScoredAnswer:
    report: QuestionReport
    reason: str
    metrics_summary: MetricsSummary


class ReportGenerator:
    """Input-driven report generator.

    This keeps the API contract usable before the SFT adapter is served.
    Replace this class internals with model inference later; keep the schema.
    """

    REQUIREMENT_KEYWORDS = [
        "Spring",
        "Spring Boot",
        "Java",
        "Redis",
        "MySQL",
        "JPA",
        "성능",
        "장애",
        "모니터링",
        "API",
        "테스트",
        "협업",
        "보안",
        "AWS",
        "Docker",
    ]

    RESULT_PATTERNS = [
        r"\d+%",
        r"\d+\s?ms",
        r"\d+\s?초",
        r"\d+\s?분",
        r"개선",
        r"감소",
        r"증가",
        r"측정",
        r"비교",
    ]

    def generate(self, request: ReportRequest) -> ReportResponse:
        scored_answers = [self._score_answer(answer) for answer in request.interview_answers]
        if not scored_answers:
            raise ValueError("interview_answers must not be empty")

        best = max(scored_answers, key=lambda item: item.report.score)
        worst = min(scored_answers, key=lambda item: item.report.score)
        fit_gap = self._build_fit_gap(request, scored_answers)
        overall_score = round(
            sum(item.report.score for item in scored_answers) / len(scored_answers),
            1,
        )

        return ReportResponse(
            session_id=request.session_id,
            overall_score=overall_score,
            top_summary=TopSummary(
                best_question=QuestionHighlight(
                    question_id=best.report.question_id,
                    question=best.report.question,
                    reason=best.reason,
                    metrics_summary=best.metrics_summary,
                ),
                worst_question=QuestionHighlight(
                    question_id=worst.report.question_id,
                    question=worst.report.question,
                    reason=worst.reason,
                    metrics_summary=worst.metrics_summary,
                ),
            ),
            fit_gap=fit_gap,
            question_reports=[item.report for item in scored_answers],
        )

    def _score_answer(self, answer) -> ScoredAnswer:
        answer_text = (answer.answer or "").strip()
        metrics_summary = self._metrics_summary(answer)

        score = 5.0
        strengths: list[str] = []
        improvements: list[str] = []

        if len(answer_text) >= 80:
            score += 1.0
            strengths.append("답변에 충분한 설명량이 포함되어 있습니다.")
        else:
            improvements.append("핵심 근거와 실제 경험을 한두 문장 더 보완하세요.")

        if self._has_result(answer_text):
            score += 1.0
            strengths.append("결과나 개선 효과를 언급해 설득력을 높였습니다.")
        else:
            improvements.append("적용 전후 수치나 결과를 포함하면 평가가 좋아집니다.")

        if self._has_action(answer_text):
            score += 0.8
            strengths.append("본인이 수행한 행동이 드러납니다.")
        else:
            improvements.append("본인이 직접 한 행동을 구체적으로 설명하세요.")

        if metrics_summary.star_structure != "Action/Result 부족":
            score += 0.7
        else:
            improvements.append("STAR 구조에서 Action과 Result를 분명히 말하세요.")

        if metrics_summary.sentence_clarity == "장황함":
            score -= 0.5
            improvements.append("문장을 짧게 나누어 핵심부터 답변하세요.")

        if metrics_summary.speaking_speed in {"빠름", "느림"}:
            score -= 0.3
            improvements.append("말하기 속도를 조금 더 안정적으로 조절하세요.")

        score = max(1.0, min(10.0, round(score, 1)))

        if not strengths:
            strengths.append("질문 의도를 일부 파악하고 답변을 시도했습니다.")
        if not improvements:
            improvements.append("현재 답변의 구체성을 유지하면서 핵심을 더 압축하세요.")

        reason = self._build_reason(answer_text, score, metrics_summary)

        return ScoredAnswer(
            report=QuestionReport(
                question_id=answer.question_id,
                question=answer.question,
                answer=answer_text,
                score=score,
                strengths=strengths,
                improvements=improvements,
                replay=Replay(
                    audio_url=answer.audio_url,
                    start_time=answer.answer_start,
                    end_time=answer.answer_end,
                ),
            ),
            reason=reason,
            metrics_summary=metrics_summary,
        )

    def _metrics_summary(self, answer) -> MetricsSummary:
        metrics = answer.metrics
        answer_text = answer.answer or ""
        star = self._infer_star(answer_text)

        return MetricsSummary(
            speaking_speed=(metrics.speaking_speed if metrics else None) or "미측정",
            silence=(metrics.silence if metrics else None) or "미측정",
            sentence_clarity=(metrics.sentence_clarity if metrics else None)
            or self._infer_sentence_clarity(answer_text),
            star_structure=(metrics.star_structure if metrics and metrics.star_structure != "AI 판단 필요" else star),
        )

    def _build_fit_gap(self, request: ReportRequest, scored_answers: list[ScoredAnswer]) -> FitGap:
        job_text = request.company_context.job_posting_summary or ""
        resume_text = " ".join(request.candidate_context.resume_summaries)
        answer_text = " ".join(item.report.answer for item in scored_answers)

        required = self._extract_requirements(job_text)
        if not required:
            required = self._extract_requirements(resume_text + " " + answer_text)

        evidence = (resume_text + " " + answer_text).lower()
        matched = [keyword for keyword in required if keyword.lower() in evidence]
        missing = [keyword for keyword in required if keyword.lower() not in evidence]

        if not matched:
            matched = ["질문에 대한 기본 답변 흐름"]
        if not missing:
            missing = ["성과 수치 또는 검증 근거"]

        recommendations = [
            f"{keyword} 경험을 답변에서 구체적인 상황, 행동, 결과로 연결하세요."
            for keyword in missing[:3]
        ]

        return FitGap(
            matched_requirements=matched[:5],
            missing_requirements=missing[:5],
            recommendations=recommendations,
        )

    def _extract_requirements(self, text: str) -> list[str]:
        found = []
        for keyword in self.REQUIREMENT_KEYWORDS:
            if keyword.lower() in text.lower() and keyword not in found:
                found.append(keyword)
        return found

    def _has_result(self, text: str) -> bool:
        return any(re.search(pattern, text, re.IGNORECASE) for pattern in self.RESULT_PATTERNS)

    def _has_action(self, text: str) -> bool:
        action_words = ["구현", "적용", "설계", "개선", "분석", "해결", "도입", "튜닝", "작성"]
        return any(word in text for word in action_words)

    def _infer_star(self, text: str) -> str:
        has_situation = any(word in text for word in ["상황", "문제", "요구", "과제"])
        has_action = self._has_action(text)
        has_result = self._has_result(text)

        if has_situation and has_action and has_result:
            return "S/T/A/R 모두 충족"
        if has_action and has_result:
            return "Action/Result 충족"
        if has_action:
            return "Result 부족"
        return "Action/Result 부족"

    def _infer_sentence_clarity(self, text: str) -> str:
        if not text.strip():
            return "미측정"
        sentences = [part for part in re.split(r"[.!?。！？]|다\.|요\.", text) if part.strip()]
        avg_len = len(text) / max(1, len(sentences))
        if avg_len > 80:
            return "장황함"
        if avg_len < 20:
            return "짧음"
        return "보통"

    def _build_reason(self, text: str, score: float, metrics_summary: MetricsSummary) -> str:
        if score >= 7.5:
            return "구체적인 행동과 결과가 드러나 Best 문항 후보로 적합합니다."
        if score <= 5.5:
            return "답변의 기본 방향은 있으나 근거, 행동, 결과가 부족해 보완이 필요합니다."
        return (
            "핵심 답변은 가능하지만 "
            f"{metrics_summary.star_structure} 상태라 더 구체적인 결과 설명이 필요합니다."
        )
