from pydantic import BaseModel


class TopStructureAnalysisItem(BaseModel):
    session_id: str
    question_type: str
    elements: dict[str, bool]
    reason: str


class TopSummaryAnalysisResponse(BaseModel):
    structure_analysis: list[TopStructureAnalysisItem]
