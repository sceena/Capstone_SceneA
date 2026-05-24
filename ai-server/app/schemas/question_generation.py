from pydantic import BaseModel, Field, field_validator


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
