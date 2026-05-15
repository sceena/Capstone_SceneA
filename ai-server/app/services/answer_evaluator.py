from app.model.inference import ModelInference, ModelUnavailable
from app.model.json_utils import ModelJsonError
from app.model.prompts import build_answer_evaluation_prompt
from app.schemas.evaluation import AnswerEvaluation, ModelAnswerEvaluation
from app.schemas.report import InterviewAnswer, MetricsSummary, QuestionReport, Replay
from app.schemas.report import ReportRequest
from app.services.text_signals import has_action, has_result, infer_sentence_clarity, infer_star


class AnswerEvaluator:
    """Step 1: evaluate each question-answer pair.

    The current implementation is deterministic. Later, this class is the main
    replacement point for SFT model inference.
    """

    def __init__(self, model_inference: ModelInference | None = None) -> None:
        self.model_inference = model_inference or ModelInference()

    def evaluate(self, answer: InterviewAnswer, request: ReportRequest | None = None) -> AnswerEvaluation:
        if request is not None:
            model_evaluation = self._try_model_evaluation(answer, request)
            if model_evaluation is not None:
                return self._from_model(answer, model_evaluation)

        return self._fallback_evaluate(answer)

    def _try_model_evaluation(
        self,
        answer: InterviewAnswer,
        request: ReportRequest,
    ) -> ModelAnswerEvaluation | None:
        try:
            prompt = build_answer_evaluation_prompt(answer, request)
            raw = self.model_inference.generate_json(prompt)
            return ModelAnswerEvaluation.model_validate(raw)
        except (ModelUnavailable, ModelJsonError, ValueError):
            return None

    def _from_model(self, answer: InterviewAnswer, model_evaluation: ModelAnswerEvaluation) -> AnswerEvaluation:
        answer_text = (answer.answer or "").strip()
        metrics_summary = self._metrics_summary(answer, model_evaluation.star_structure)
        score = max(1.0, min(10.0, round(model_evaluation.overall_score, 1)))

        strengths = model_evaluation.strengths or ["질문 의도를 일부 파악하고 답변을 시도했습니다."]
        improvements = model_evaluation.improvements or ["답변을 더 구체적인 상황, 행동, 결과로 보완하세요."]

        return AnswerEvaluation(
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
            highlight_reason=model_evaluation.reasoning or self._build_reason(score, metrics_summary),
            metrics_summary=metrics_summary,
        )

    def _fallback_evaluate(self, answer: InterviewAnswer) -> AnswerEvaluation:
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

        if has_result(answer_text):
            score += 1.0
            strengths.append("결과나 개선 효과를 언급해 설득력을 높였습니다.")
        else:
            improvements.append("적용 전후 수치나 결과를 포함하면 평가가 좋아집니다.")

        if has_action(answer_text):
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

        return AnswerEvaluation(
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
            highlight_reason=self._build_reason(score, metrics_summary),
            metrics_summary=metrics_summary,
        )

    def _metrics_summary(self, answer: InterviewAnswer, model_star_structure: str | None = None) -> MetricsSummary:
        metrics = answer.metrics
        answer_text = answer.answer or ""
        star = infer_star(answer_text)
        if model_star_structure and model_star_structure != "AI 판단 필요":
            star = model_star_structure

        return MetricsSummary(
            speaking_speed=(metrics.speaking_speed if metrics else None) or "미측정",
            silence=(metrics.silence if metrics else None) or "미측정",
            sentence_clarity=(metrics.sentence_clarity if metrics else None)
            or infer_sentence_clarity(answer_text),
            star_structure=(metrics.star_structure if metrics and metrics.star_structure != "AI 판단 필요" else star),
        )

    def _build_reason(self, score: float, metrics_summary: MetricsSummary) -> str:
        if score >= 7.5:
            return "구체적인 행동과 결과가 드러나 Best 문항 후보로 적합합니다."
        if score <= 5.5:
            return "답변의 기본 방향은 있으나 근거, 행동, 결과가 부족해 보완이 필요합니다."
        return (
            "핵심 답변은 가능하지만 "
            f"{metrics_summary.star_structure} 상태라 더 구체적인 결과 설명이 필요합니다."
        )
