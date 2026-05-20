from fastapi import APIRouter, HTTPException

from app.schemas.fit_gap import FitGapAnalysisResponse, FitGapRequest
from app.schemas.report import ReportRequest, ReportResponse
from app.services.fit_gap_composer import FitGapComposer, FitGapComposerUnavailable
from app.services.report_generator import ReportGenerator

router = APIRouter(tags=["report"])
report_generator = ReportGenerator()
fit_gap_composer = FitGapComposer()


@router.post("/report", response_model=ReportResponse)
def generate_report(request: ReportRequest) -> ReportResponse:
    return report_generator.generate(request)


@router.post("/api/fit-gap", response_model=FitGapAnalysisResponse)
def generate_fit_gap(request: FitGapRequest) -> FitGapAnalysisResponse:
    try:
        return fit_gap_composer.generate(
            job_description=request.job_description,
            interview_session=request.interview_session,
            resume_summary=request.resume_summary,
        )
    except FitGapComposerUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"Fit-Gap model returned invalid JSON: {exc}") from exc
