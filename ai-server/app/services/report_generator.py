from app.schemas.report import ReportRequest, ReportResponse
from app.services.answer_evaluator import AnswerEvaluator
from app.services.report_composer import ReportComposer


class ReportGenerator:
    """Orchestrates answer evaluation and session report composition."""

    def __init__(
        self,
        answer_evaluator: AnswerEvaluator | None = None,
        report_composer: ReportComposer | None = None,
    ) -> None:
        self.answer_evaluator = answer_evaluator or AnswerEvaluator()
        self.report_composer = report_composer or ReportComposer()

    def generate(self, request: ReportRequest) -> ReportResponse:
        evaluations = [
            self.answer_evaluator.evaluate(answer, request)
            for answer in request.interview_answers
        ]
        return self.report_composer.compose(request, evaluations)
