from dataclasses import dataclass

from pydantic import BaseModel, Field, field_validator

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

    @field_validator("reasoning", mode="before")
    @classmethod
    def normalize_reasoning(cls, value) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("strengths", "improvements", mode="before")
    @classmethod
    def normalize_list(cls, value) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]
