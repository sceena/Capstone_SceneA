from app.schemas.evaluation import AnswerEvaluation
from app.schemas.report import FitGap, QuestionHighlight, ReportRequest, ReportResponse, TopSummary


class ReportComposer:
    """Step 2: compose a session-level report from answer evaluations."""

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

    def compose(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> ReportResponse:
        if not evaluations:
            raise ValueError("interview_answers must not be empty")

        best = max(evaluations, key=lambda item: item.report.score)
        worst = min(evaluations, key=lambda item: item.report.score)
        overall_score = round(
            sum(item.report.score for item in evaluations) / len(evaluations),
            1,
        )

        return ReportResponse(
            session_id=request.session_id,
            overall_score=overall_score,
            top_summary=TopSummary(
                best_question=QuestionHighlight(
                    question_id=best.report.question_id,
                    question=best.report.question,
                    reason=best.highlight_reason,
                    metrics_summary=best.metrics_summary,
                ),
                worst_question=QuestionHighlight(
                    question_id=worst.report.question_id,
                    question=worst.report.question,
                    reason=worst.highlight_reason,
                    metrics_summary=worst.metrics_summary,
                ),
            ),
            fit_gap=self._build_fit_gap(request, evaluations),
            question_reports=[item.report for item in evaluations],
        )

    def _build_fit_gap(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> FitGap:
        job_text = request.company_context.job_posting_summary or ""
        resume_text = " ".join(request.candidate_context.resume_summaries)
        answer_text = " ".join(item.report.answer for item in evaluations)

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
