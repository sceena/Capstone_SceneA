from pydantic import BaseModel, Field


class SttSegment(BaseModel):
    start_sec: float
    end_sec: float
    text: str


class SttResponse(BaseModel):
    text: str
    model: str | None = None
    language: str | None = None
    duration_sec: int | None = None
    audio_quality_status: str | None = None
    audio_quality_message: str | None = None
    segments: list[SttSegment] = Field(default_factory=list)


class SttJobRequest(BaseModel):
    answer_id: int | None = None
    question_id: int | None = None
    audio_key: str
    callback_url: str
    bucket: str | None = None


class SttJobResponse(BaseModel):
    answer_id: int | None = None
    question_id: int | None = None
    status: str
    message: str


class SttCallbackPayload(BaseModel):
    answer_id: int | None = None
    question_id: int | None = None
    status: str
    text: str | None = None
    model: str | None = None
    language: str | None = None
    duration_sec: int | None = None
    audio_quality_status: str | None = None
    audio_quality_message: str | None = None
    error_message: str | None = None
    segments: list[SttSegment] = Field(default_factory=list)
