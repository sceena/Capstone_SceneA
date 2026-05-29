import os
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.fit_gap import FitGapAnalysisResponse, FitGapRequest
from app.schemas.question_generation import (
    CommonQuestionGenerationRequest,
    CommonQuestionGenerationResponse,
    QuestionGenerationRequest,
    QuestionGenerationResponse,
    SessionQuestionGenerationRequest,
    SessionQuestionGenerationResponse,
)
from app.schemas.report import ReportRequest, ReportResponse
from app.schemas.stt import SttJobRequest, SttJobResponse, SttResponse
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
stt_executor = ThreadPoolExecutor(max_workers=int(os.getenv("STT_WORKER_COUNT", "1")))


def _question_generation_error_status(detail: str) -> int:
    if "timed out" in detail:
        return 504
    if "RESOURCE_EXHAUSTED" in detail or "429" in detail:
        return 429
    return 503


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


@router.post("/api/stt/jobs", response_model=SttJobResponse, status_code=202)
def create_stt_job(request: SttJobRequest) -> SttJobResponse:
    stt_executor.submit(
        stt_service.process_s3_job,
        request.answer_id,
        request.audio_key,
        request.callback_url,
        request.bucket,
    )
    return SttJobResponse(
        answer_id=request.answer_id,
        status="ACCEPTED",
        message="STT job accepted.",
    )


@router.post("/api/generate-questions", response_model=QuestionGenerationResponse)
def generate_questions(request: QuestionGenerationRequest) -> QuestionGenerationResponse:
    try:
        questions = question_generator.generate(request.content)
        return QuestionGenerationResponse(questions=questions)
    except QuestionGenerationInvalidResponse as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except QuestionGenerationUnavailable as exc:
        detail = str(exc)
        status_code = _question_generation_error_status(detail)
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/api/generate-common-questions", response_model=CommonQuestionGenerationResponse)
def generate_common_questions(request: CommonQuestionGenerationRequest) -> CommonQuestionGenerationResponse:
    try:
        candidates = [candidate.model_dump() for candidate in request.candidates]
        questions = question_generator.generate_common_questions(candidates)
        return CommonQuestionGenerationResponse(common_questions=questions)
    except QuestionGenerationInvalidResponse as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except QuestionGenerationUnavailable as exc:
        detail = str(exc)
        status_code = _question_generation_error_status(detail)
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/api/generate-session-questions", response_model=SessionQuestionGenerationResponse)
def generate_session_questions(request: SessionQuestionGenerationRequest) -> SessionQuestionGenerationResponse:
    try:
        candidates = [candidate.model_dump() for candidate in request.candidates]
        result = question_generator.generate_for_session(request.session_type, candidates)
        return SessionQuestionGenerationResponse.model_validate(result)
    except QuestionGenerationInvalidResponse as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except QuestionGenerationUnavailable as exc:
        detail = str(exc)
        status_code = _question_generation_error_status(detail)
        raise HTTPException(status_code=status_code, detail=detail) from exc
