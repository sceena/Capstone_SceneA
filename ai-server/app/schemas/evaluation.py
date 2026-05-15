from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.schemas.report import MetricsSummary, QuestionReport


@dataclass(frozen=True)
class AnswerEvaluation:
    report: QuestionReport
    highlight_reason: str
    metrics_summary: MetricsSummary


class ModelAnswerEvaluation(BaseModel):
    reasoning: str = ""
    overall_score: float = Field(default=5.0, ge=1.0, le=10.0)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
