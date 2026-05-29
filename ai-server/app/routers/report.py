from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.fit_gap import FitGapAnalysisResponse, FitGapRequest
from app.schemas.question_generation import QuestionGenerationRequest, QuestionGenerationResponse
from app.schemas.report import ReportRequest, ReportResponse
from app.schemas.stt import SttResponse
from app.services.fit_gap_composer import FitGapComposer, FitGapComposerUnavailable
from app.services.question_generator import (
    QuestionGenerationInvalidResponse,
    QuestionGenerationUnavailable,
    QuestionGenerator,
)
from app.services.report_generator import ReportGenerator
from app.services.stt_service import SttService, SttServiceUnavailable

router = APIRouter(tags=["report"])
report_generator = ReportGenerator()
fit_gap_composer = FitGapComposer()
stt_service = SttService()
question_generator = QuestionGenerator()


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
        result = stt_service.transcribe(audio.filename, audio.file)
        return SttResponse(
            text=result.text,
            model=result.model,
            language=result.language,
            duration_sec=result.duration_sec,
            audio_quality_status=result.audio_quality_status,
            audio_quality_message=result.audio_quality_message,
            segments=[segment.__dict__ for segment in result.segments],
        )
    except SttServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/api/generate-questions", response_model=QuestionGenerationResponse)
def generate_questions(request: QuestionGenerationRequest) -> QuestionGenerationResponse:
    try:
        questions = question_generator.generate(request.content)
        return QuestionGenerationResponse(questions=questions)
    except QuestionGenerationInvalidResponse as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except QuestionGenerationUnavailable as exc:
        detail = str(exc)
        status_code = 504 if "timed out" in detail else 503
        raise HTTPException(status_code=status_code, detail=detail) from exc
