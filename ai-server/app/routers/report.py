from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.fit_gap import FitGapAnalysisResponse, FitGapRequest
from app.schemas.report import ReportRequest, ReportResponse
from app.schemas.stt import SttResponse
from app.services.fit_gap_composer import FitGapComposer, FitGapComposerUnavailable
from app.services.report_generator import ReportGenerator
from app.services.stt_service import SttService, SttServiceUnavailable

router = APIRouter(tags=["report"])
report_generator = ReportGenerator()
fit_gap_composer = FitGapComposer()
stt_service = SttService()


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


@router.post("/api/stt", response_model=SttResponse)
def transcribe_audio(audio: UploadFile = File(...)) -> SttResponse:
    try:
        text = stt_service.transcribe(audio.filename, audio.file)
        return SttResponse(text=text)
    except SttServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
