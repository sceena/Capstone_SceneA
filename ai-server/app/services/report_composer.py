import logging

from app.schemas.evaluation import AnswerEvaluation
from app.schemas.report import FitGap, QuestionHighlight, ReportRequest, ReportResponse, TopSummary
from app.services.fit_gap_composer import FitGapComposer, FitGapComposerUnavailable
from app.services.top_summary_composer import TopSummaryComposer, TopSummaryComposerUnavailable


class ReportComposer:
    """Step 2: compose a session-level report from answer evaluations."""

    logger = logging.getLogger(__name__)

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
        "MSSQL",
        "MySQL",
        "Mongo",
        "MongoDB",
        "DB",
        "JPA",
        "쿼리",
        "튜닝",
        "성능",
        "장애",
        "모니터링",
        "API",
        "테스트",
        "협업",
        "보안",
        "AWS",
        "Docker",
        "예약",
        "결제",
        "쿠폰",
        "빌링",
    ]
    REQUIREMENT_GROUPS = [
        ("Java/Spring 백엔드 개발 경험", ["Java", "Spring", "Spring Boot", "백엔드"]),
        ("관계형 데이터베이스 개발 및 운영", ["DB", "MSSQL", "MySQL", "RDBMS", "데이터베이스"]),
        ("MongoDB 등 NoSQL 활용 경험", ["Mongo", "MongoDB", "NoSQL"]),
        ("ERD 설계 및 데이터 모델링", ["ERD", "설계", "모델링"]),
        ("쿼리 성능 개선 및 튜닝", ["쿼리", "튜닝", "성능", "인덱스", "실행 계획"]),
        ("예약/결제/쿠폰/빌링 도메인 이해", ["예약", "결제", "쿠폰", "빌링", "무인화"]),
        ("AWS 또는 IDC 운영 경험", ["AWS", "EC2", "RDS", "S3", "IDC", "클라우드"]),
        ("배포 자동화 및 운영 경험", ["Docker", "CI/CD", "GitHub Actions", "Jenkins", "배포", "운영"]),
        ("장애 분석 및 로그 기반 문제 해결", ["장애", "로그", "모니터링", "알림"]),
        ("테스트 코드와 협업 경험", ["테스트", "코드 리뷰", "협업", "Git"]),
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
                    highlight_type="best",
                ),
                worst_question=self._to_question_highlight(
                    worst[1],
                    structure_analysis.get(f"Session{worst[0]}"),
                    highlight_type="worst",
                ),
            )

        best = max(evaluations, key=self._best_rank_score)
        worst = min(evaluations, key=self._worst_rank_score)
        return TopSummary(
            best_question=self._to_question_highlight(best, highlight_type="best"),
            worst_question=self._to_question_highlight(worst, highlight_type="worst"),
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
        except (TopSummaryComposerUnavailable, ValueError) as exc:
            self.logger.warning("TopSummary Gemini unavailable; using fallback top summary. reason=%s", exc)
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
        return round((present_count / len(expected)) * 5, 1)

    def _to_question_highlight(
        self,
        evaluation: AnswerEvaluation,
        structure_analysis: dict | None = None,
        highlight_type: str = "best",
    ) -> QuestionHighlight:
        return QuestionHighlight(
            question_id=evaluation.report.question_id,
            question=evaluation.report.question,
            reason=self._top_summary_reason(evaluation, structure_analysis, highlight_type),
            metrics_summary=evaluation.metrics_summary,
        )

    def _top_summary_reason(
        self,
        evaluation: AnswerEvaluation,
        structure_analysis: dict | None,
        highlight_type: str,
    ) -> str:
        if highlight_type == "worst":
            return self._worst_summary_reason(evaluation, structure_analysis)

        if not structure_analysis:
            return evaluation.highlight_reason

        structure_reason = (
            structure_analysis.get("strength_reason")
            or structure_analysis.get("reason")
            or ""
        ).strip()
        if not structure_reason:
            return evaluation.highlight_reason

        return structure_reason

    def _worst_summary_reason(self, evaluation: AnswerEvaluation, structure_analysis: dict | None) -> str:
        if structure_analysis:
            weakness_reason = (structure_analysis.get("weakness_reason") or "").strip()
            if weakness_reason:
                return weakness_reason

        missing_elements = self._missing_structure_labels(structure_analysis)
        if missing_elements:
            return f"{', '.join(missing_elements)} 요소가 답변에서 충분히 드러나지 않아 보완이 필요합니다."

        metrics = evaluation.metrics_summary
        if metrics.speaking_speed in {"빠름", "느림"}:
            return f"말하기 속도가 {metrics.speaking_speed} 편이라 핵심 내용을 안정적으로 전달하는 데 보완이 필요합니다."
        if metrics.silence in {"많음", "긴 침묵", "불안정"}:
            return f"{metrics.silence}이 확인되어 답변 흐름이 끊기지 않도록 보완이 필요합니다."
        if metrics.sentence_clarity in {"장황함", "짧음"}:
            return f"문장 명료도가 {metrics.sentence_clarity} 상태라 근거와 결론을 더 분명히 말할 필요가 있습니다."

        improvements = evaluation.report.improvements
        if improvements:
            return improvements[0]

        return "답변의 구체적인 근거와 결과가 부족해 보완이 필요합니다."

    def _missing_structure_labels(self, structure_analysis: dict | None) -> list[str]:
        if not structure_analysis:
            return []

        question_type = structure_analysis.get("question_type")
        expected = self.STRUCTURE_ELEMENTS_BY_TYPE.get(question_type, [])
        elements = structure_analysis.get("elements") or {}
        labels = {
            "situation": "상황",
            "task": "과제",
            "action": "행동",
            "result": "결과",
            "claim": "주장",
            "reason": "근거",
            "example": "예시",
            "situation_understanding": "상황 이해",
            "action_plan": "대응 계획",
            "rationale": "판단 근거",
            "concept": "개념",
            "explanation": "설명",
        }
        return [
            labels.get(element, element)
            for element in expected
            if not elements.get(element)
        ]

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
        score = 5.0

        if summary.speaking_speed in {"빠름", "느림"}:
            score -= 0.8
        elif summary.speaking_speed == "미측정":
            score -= 0.3

        if summary.silence in {"많음", "긴 침묵", "불안정"}:
            score -= 0.8
        elif summary.silence == "미측정":
            score -= 0.3

        if summary.sentence_clarity in {"장황함", "짧음"}:
            score -= 0.6
        elif summary.sentence_clarity == "미측정":
            score -= 0.3

        return max(1.0, min(5.0, score))

    def _star_rank_score(self, star_structure: str) -> float:
        if star_structure == "S/T/A/R 모두 충족":
            return 5.0
        if star_structure == "Action/Result 충족":
            return 4.0
        if star_structure == "Result 부족":
            return 2.5
        if star_structure == "Action/Result 부족":
            return 1.5
        return 2.5

    def _build_fit_gap(self, request: ReportRequest, evaluations: list[AnswerEvaluation]) -> FitGap:
        job_description = request.company_context.job_posting_summary or ""
        applicant_document = "\n".join(request.candidate_context.resume_summaries)
        interview_session = self._format_interview_session(evaluations)

        try:
            return self.fit_gap_composer.generate_fit_gap(job_description, interview_session, applicant_document)
        except (FitGapComposerUnavailable, ValueError) as exc:
            self.logger.warning("Fit-Gap Gemini unavailable; using fallback fit-gap. reason=%s", exc)
            return self.fit_gap_composer.generate_fit_gap_fallback(job_description, interview_session, applicant_document)

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

        required = self._extract_requirement_items(job_text)
        if not required:
            required = self._extract_requirement_items(applicant_document_text + " " + answer_text)

        evidence_sources = [
            ("지원자 제출 문서", applicant_document_text),
            ("면접 답변", answer_text),
        ]
        matched = []
        missing = []
        for item in required:
            evidence = self._find_requirement_evidence(item["terms"], evidence_sources)
            if evidence:
                matched.append(f"요구사항: {item['label']} / 근거({evidence[0]}): {evidence[1]} 언급 확인")
            else:
                missing.append(f"요구사항: {item['label']} / 부족 근거: 제출 문서와 면접 답변에서 직접적인 근거가 부족합니다.")

        if not matched:
            matched = ["요구사항: 질문과 관련된 기본 답변 흐름 / 근거(면접 답변): 질문에 대한 기본 응답은 확인됩니다."]
        if not missing:
            missing = ["요구사항: 성과 수치 또는 검증 근거 / 부족 근거: 적용 전후 지표나 운영 검증 근거를 더 보완하면 좋습니다."]

        recommendations = [
            f"{self._plain_requirement_label(item)} 경험을 답변에서 구체적인 상황, 행동, 결과로 연결하세요."
            for keyword in missing[:3]
            for item in [keyword]
        ]

        return FitGap(
            matched_requirements=matched[:5],
            missing_requirements=missing[:5],
            recommendations=recommendations,
        )

    def _extract_requirement_items(self, text: str) -> list[dict[str, list[str] | str]]:
        found = []
        normalized_text = text.lower()
        for label, terms in self.REQUIREMENT_GROUPS:
            if any(term.lower() in normalized_text for term in terms):
                found.append({"label": label, "terms": terms})
        existing_labels = {item["label"] for item in found}
        for keyword in self._extract_requirements(text):
            if keyword not in existing_labels:
                found.append({"label": keyword, "terms": [keyword]})
        return found

    def _find_requirement_evidence(self, terms: list[str], evidence_sources: list[tuple[str, str]]) -> tuple[str, str] | None:
        for source_name, text in evidence_sources:
            lower_text = text.lower()
            for term in terms:
                if term.lower() in lower_text:
                    return source_name, term
        return None

    def _plain_requirement_label(self, item: str) -> str:
        value = item.replace("요구사항:", "").strip()
        return value.split(" / ", 1)[0].strip()

    def _extract_requirements(self, text: str) -> list[str]:
        found = []
        for keyword in self.REQUIREMENT_KEYWORDS:
            if keyword.lower() in text.lower() and keyword not in found:
                found.append(keyword)
        return found
