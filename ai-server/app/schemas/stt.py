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

