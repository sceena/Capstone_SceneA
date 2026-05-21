from app.schemas.evaluation import AnswerEvaluation
from app.schemas.report import FitGap, QuestionHighlight, ReportRequest, ReportResponse, TopSummary
from app.services.fit_gap_composer import FitGapComposer, FitGapComposerUnavailable
from app.services.top_summary_composer import TopSummaryComposer, TopSummaryComposerUnavailable


class ReportComposer:
    """Step 2: compose a session-level report from answer evaluations."""

    STRUCTURE_ELEMENTS_BY_TYPE = {
        "experience": ["situation", "task", "action", "result"],
        "opinion": ["claim", "reason", "example"],
        "situational": ["situation_understanding", "action_plan", "rationale"],
        "knowledge": ["concept", "explanation", "example"],
    }

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

    def __init__(
        self,
        fit_gap_composer: FitGapComposer | None = None,
        top_summary_composer: TopSummaryComposer | None = None,
    ) -> None:
        self.fit_gap_composer = fit_gap_composer or FitGapComposer()
        self.top_summary_composer = top_summary_composer or TopSummaryComposer()

    def compose(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> ReportResponse:
        if not evaluations:
            raise ValueError("interview_answers must not be empty")

        overall_score = round(
            sum(item.report.score for item in evaluations) / len(evaluations),
            1,
        )

        return ReportResponse(
            session_id=request.session_id,
            overall_score=overall_score,
            top_summary=self._build_top_summary(evaluations),
            fit_gap=self._build_fit_gap(request, evaluations),
            question_reports=[item.report for item in evaluations],
        )

    def _build_top_summary(self, evaluations: list[AnswerEvaluation]) -> TopSummary:
        structure_analysis = self._try_top_structure_analysis(evaluations)

        if structure_analysis:
            best = max(
                enumerate(evaluations, start=1),
                key=lambda item: self._top_rank_score(item[1], structure_analysis.get(f"Session{item[0]}")),
            )
            worst = min(
                enumerate(evaluations, start=1),
                key=lambda item: self._top_rank_score(item[1], structure_analysis.get(f"Session{item[0]}")),
            )

            return TopSummary(
                best_question=self._to_question_highlight(
                    best[1],
                    structure_analysis.get(f"Session{best[0]}"),
                ),
                worst_question=self._to_question_highlight(
                    worst[1],
                    structure_analysis.get(f"Session{worst[0]}"),
                ),
            )

        best = max(evaluations, key=self._best_rank_score)
        worst = min(evaluations, key=self._worst_rank_score)
        return TopSummary(
            best_question=self._to_question_highlight(best),
            worst_question=self._to_question_highlight(worst),
        )

    def _try_top_structure_analysis(self, evaluations: list[AnswerEvaluation]) -> dict[str, dict]:
        summary = {
            f"Session{index}": {
                "question_text": item.report.question,
                "answer_text": item.report.answer,
            }
            for index, item in enumerate(evaluations, start=1)
        }

        try:
            response = self.top_summary_composer.generate(summary)
        except (TopSummaryComposerUnavailable, ValueError):
            return {}

        return {
            item.session_id: item.model_dump()
            for item in response.structure_analysis
        }

    def _top_rank_score(self, evaluation: AnswerEvaluation, structure_analysis: dict | None) -> float:
        metrics_score = self._metrics_rank_score(evaluation)
        structure_score = self._structure_rank_score(structure_analysis, evaluation)
        return (evaluation.report.score * 0.6) + (metrics_score * 0.2) + (structure_score * 0.2)

    def _structure_rank_score(self, structure_analysis: dict | None, evaluation: AnswerEvaluation) -> float:
        if not structure_analysis:
            return self._star_rank_score(evaluation.metrics_summary.star_structure)

        question_type = structure_analysis.get("question_type")
        expected = self.STRUCTURE_ELEMENTS_BY_TYPE.get(question_type)
        if not expected:
            return 5.0

        elements = structure_analysis.get("elements") or {}
        present_count = sum(1 for element in expected if elements.get(element))
        return round((present_count / len(expected)) * 10, 1)

    def _to_question_highlight(
        self,
        evaluation: AnswerEvaluation,
        structure_analysis: dict | None = None,
    ) -> QuestionHighlight:
        return QuestionHighlight(
            question_id=evaluation.report.question_id,
            question=evaluation.report.question,
            reason=self._top_summary_reason(evaluation, structure_analysis),
            metrics_summary=evaluation.metrics_summary,
        )

    def _top_summary_reason(self, evaluation: AnswerEvaluation, structure_analysis: dict | None) -> str:
        if not structure_analysis:
            return evaluation.highlight_reason

        structure_reason = (structure_analysis.get("reason") or "").strip()
        if not structure_reason:
            return evaluation.highlight_reason

        return f"{structure_reason} {evaluation.highlight_reason}"

    def _best_rank_score(self, evaluation: AnswerEvaluation) -> float:
        metrics_score = self._metrics_rank_score(evaluation)
        star_score = self._star_rank_score(evaluation.metrics_summary.star_structure)
        return (evaluation.report.score * 0.7) + (metrics_score * 0.2) + (star_score * 0.1)

    def _worst_rank_score(self, evaluation: AnswerEvaluation) -> float:
        metrics_score = self._metrics_rank_score(evaluation)
        star_score = self._star_rank_score(evaluation.metrics_summary.star_structure)
        return (evaluation.report.score * 0.6) + (metrics_score * 0.25) + (star_score * 0.15)

    def _metrics_rank_score(self, evaluation: AnswerEvaluation) -> float:
        summary = evaluation.metrics_summary
        score = 10.0

        if summary.speaking_speed in {"빠름", "느림"}:
            score -= 1.5
        elif summary.speaking_speed == "미측정":
            score -= 0.5

        if summary.silence in {"많음", "긴 침묵", "불안정"}:
            score -= 1.5
        elif summary.silence == "미측정":
            score -= 0.5

        if summary.sentence_clarity in {"장황함", "짧음"}:
            score -= 1.2
        elif summary.sentence_clarity == "미측정":
            score -= 0.5

        return max(1.0, min(10.0, score))

    def _star_rank_score(self, star_structure: str) -> float:
        if star_structure == "S/T/A/R 모두 충족":
            return 10.0
        if star_structure == "Action/Result 충족":
            return 8.0
        if star_structure == "Result 부족":
            return 5.0
        if star_structure == "Action/Result 부족":
            return 3.0
        return 5.0

    def _build_fit_gap(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> FitGap:
        job_description = request.company_context.job_posting_summary or ""
        applicant_document = "\n".join(request.candidate_context.resume_summaries)
        interview_session = self._format_interview_session(evaluations)

        try:
            return self.fit_gap_composer.generate_fit_gap(job_description, interview_session, applicant_document)
        except (FitGapComposerUnavailable, ValueError):
            return self._build_keyword_fit_gap(request, evaluations)

    def _format_interview_session(self, evaluations: list[AnswerEvaluation]) -> str:
        lines = []
        for index, item in enumerate(evaluations, start=1):
            lines.append(f"Q{index}. {item.report.question}")
            lines.append(f"A{index}. {item.report.answer}")
        return "\n".join(lines)

    def _build_keyword_fit_gap(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> FitGap:
        job_text = request.company_context.job_posting_summary or ""
        applicant_document_text = " ".join(request.candidate_context.resume_summaries)
        answer_text = " ".join(item.report.answer for item in evaluations)

        required = self._extract_requirements(job_text)
        if not required:
            required = self._extract_requirements(applicant_document_text + " " + answer_text)

        evidence = (applicant_document_text + " " + answer_text).lower()
        matched = [keyword for keyword in required if keyword.lower() in evidence]
        missing = [keyword for keyword in required if keyword.lower() not in evidence]

        if not matched:
            matched = ["질문과 관련된 기본 답변 흐름"]
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
