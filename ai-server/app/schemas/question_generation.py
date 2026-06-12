from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class QuestionGenerationRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("content must not be blank")
        return value


class QuestionGenerationResponse(BaseModel):
    questions: list[str]


class QuestionGenerationCandidate(BaseModel):
    candidate_id: int | None = None
    name: str | None = None
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("content must not be blank")
        return value


class SessionQuestionGenerationRequest(BaseModel):
    session_type: Literal["ONE_TO_ONE", "GROUP"]
    candidates: list[QuestionGenerationCandidate] = Field(min_length=1)

    @field_validator("session_type", mode="before")
    @classmethod
    def normalize_session_type(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def validate_candidate_count(self) -> "SessionQuestionGenerationRequest":
        candidate_count = len(self.candidates)
        if self.session_type == "ONE_TO_ONE" and candidate_count != 1:
            raise ValueError("ONE_TO_ONE session must contain exactly one candidate")
        if self.session_type == "GROUP" and candidate_count < 2:
            raise ValueError("GROUP session must contain at least two candidates")
        return self


class PersonalQuestionSet(BaseModel):
    candidate_id: int | None = None
    questions: list[str]


class SessionQuestionGenerationResponse(BaseModel):
    session_type: Literal["ONE_TO_ONE", "GROUP"]
    common_questions: list[str] = Field(default_factory=list)
    personal_questions: list[PersonalQuestionSet]


class CommonQuestionGenerationRequest(BaseModel):
    candidates: list[QuestionGenerationCandidate] = Field(min_length=2)


class CommonQuestionGenerationResponse(BaseModel):
    common_questions: list[str]
