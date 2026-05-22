from pydantic import BaseModel


class TopStructureAnalysisItem(BaseModel):
    session_id: str
    question_type: str
    elements: dict[str, bool]
    reason: str
    strength_reason: str | None = None
    weakness_reason: str | None = None


class TopSummaryAnalysisResponse(BaseModel):
    structure_analysis: list[TopStructureAnalysisItem]
