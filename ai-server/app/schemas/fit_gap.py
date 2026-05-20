from pydantic import BaseModel


class FitGapRequest(BaseModel):
    job_description: str
    interview_session: str


class FitAnalysisItem(BaseModel):
    question_no: str
    matched_skill: str
    evidence: str


class GapAnalysisItem(BaseModel):
    missing_skill: str
    reason: str


class FitGapAnalysisResponse(BaseModel):
    fit_analysis: list[FitAnalysisItem]
    gap_analysis: list[GapAnalysisItem]
    improvement_suggestions: list[str]
    overall_summary: str
