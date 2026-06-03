import os
import logging
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
logger = logging.getLogger(__name__)
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


def load_fallback_json():
    import json
    path = os.path.join(os.path.dirname(__file__), "..", "..", "examples", "fallback", "fallback.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=500, detail=f"Fallback data file not found at {path}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load fallback JSON: {str(e)}")


def get_candidate_key(name: str | None) -> str | None:
    if not name:
        return None
    if "지아" in name or "최지아" in name:
        return "최지아"
    if "윤진" in name or "정윤진" in name:
        return "정윤진"
    if "동현" in name or "강동현" in name:
        return "강동현"
    return None


def normalize_text(text: str) -> str:
    return "".join(c for c in text if c.isalnum()).lower()


def tag_candidate_items(candidate_name: str, items: list[str]) -> list[str]:
    return [f"[{candidate_name}] {item}" for item in items]


def find_fallback_question_report(fallback_reports, mentee_name: str | None, question_text: str, index_in_candidate_answers: int):
    candidate_key = get_candidate_key(mentee_name)
    if not candidate_key:
        return None

    candidate_report = None
    for report in fallback_reports:
        if report.get("candidate_name") == candidate_key:
            candidate_report = report
            break

    if not candidate_report:
        return None

    question_reports = candidate_report.get("ai_report", {}).get("question_reports", [])
    norm_q = normalize_text(question_text)

    # 1. Try exact or substring match
    for qr in question_reports:
        norm_fallback_q = normalize_text(qr.get("question", ""))
        if norm_q in norm_fallback_q or norm_fallback_q in norm_q:
            return qr

    # 2. Fallback to index match
    if 0 <= index_in_candidate_answers < len(question_reports):
        return question_reports[index_in_candidate_answers]

    return None


@router.post("/report", response_model=ReportResponse)
def generate_report(request: ReportRequest) -> ReportResponse:
    if os.getenv("IS_DEMO_MODE", "true").lower() == "true":
        logger.info("Demo mode enabled: Generating fallback report.")
        fallback_data = load_fallback_json()

        matched_qrs = []
        candidate_counts = {}
        for ans in request.interview_answers:
            mentee_name = ans.mentee_name
            idx = candidate_counts.get(mentee_name, 0)
            candidate_counts[mentee_name] = idx + 1

            qr = find_fallback_question_report(
                fallback_data.get("reports", []),
                mentee_name,
                ans.question,
                idx
            )
            if qr:
                import copy
                qr_copy = copy.deepcopy(qr)
                qr_copy["question_id"] = ans.question_id
                qr_copy["answer_id"] = ans.answer_id
                qr_copy["mentee_id"] = ans.mentee_id
                qr_copy["mentee_name"] = ans.mentee_name
                if "ai_model_name" not in qr_copy or not qr_copy["ai_model_name"]:
                    qr_copy["ai_model_name"] = "demo-fallback-model"
                if "prompt_version" not in qr_copy or not qr_copy["prompt_version"]:
                    qr_copy["prompt_version"] = "1.0"
                if ans.audio_url:
                    qr_copy["replay"] = {
                        "audio_url": ans.audio_url,
                        "start_time": qr_copy.get("replay", {}).get("start_time"),
                        "end_time": qr_copy.get("replay", {}).get("end_time")
                    }
                matched_qrs.append(qr_copy)
            else:
                matched_qrs.append({
                    "question_id": ans.question_id,
                    "answer_id": ans.answer_id,
                    "mentee_id": ans.mentee_id,
                    "mentee_name": ans.mentee_name,
                    "question": ans.question,
                    "answer": ans.answer or "",
                    "score": 3.0,
                    "reasoning": "데모 모드 평가 데이터입니다.",
                    "strengths": ["기본적인 답변 제공"],
                    "improvements": ["더 구체적인 경험 제시 필요"],
                    "evaluation_source": "demo_fallback",
                    "ai_model_name": "demo-fallback-model",
                    "prompt_version": "1.0",
                    "replay": {
                        "audio_url": ans.audio_url or "",
                        "start_time": "00:00:00",
                        "end_time": "00:00:10"
                    }
                })

        scores = [q.get("score") for q in matched_qrs if q.get("score") is not None]
        overall_score = round(sum(scores) / len(scores), 1) if scores else 3.5

        def build_highlight(qr, highlight_type):
            if not qr:
                return None
            c_key = get_candidate_key(qr.get("mentee_name"))
            c_report = None
            for r in fallback_data.get("reports", []):
                if r.get("candidate_name") == c_key:
                    c_report = r
                    break

            reason = "답변에 대한 우수한 평가입니다." if highlight_type == "best" else "답변에 보완이 필요한 부분입니다."
            metrics_summary = {
                "speaking_speed": "적정",
                "silence": "침묵 없음",
                "sentence_clarity": "명확",
                "star_structure": "S/T/A/R 모두 충족"
            }

            if c_report:
                orig_ts = c_report.get("ai_report", {}).get("top_summary", {})
                orig_highlight = orig_ts.get("best_question" if highlight_type == "best" else "worst_question", {})
                reason = orig_highlight.get("reason", reason)
                metrics_summary = orig_highlight.get("metrics_summary", metrics_summary)

            return {
                "question_id": qr.get("question_id"),
                "question": qr.get("question"),
                "reason": reason,
                "metrics_summary": metrics_summary
            }

        top_summary = {
            "best_question": build_highlight(
                max(matched_qrs, key=lambda x: x.get("score", 0.0)) if matched_qrs else None, "best"
            ),
            "worst_question": build_highlight(
                min(matched_qrs, key=lambda x: x.get("score", 5.0)) if matched_qrs else None, "worst"
            )
        }

        # Build Fit-Gap (Combined for group session, or individual for 1-to-1)
        candidate_names_in_req = set()
        for ans in request.interview_answers:
            c_key = get_candidate_key(ans.mentee_name)
            if c_key:
                candidate_names_in_req.add(c_key)

        matched_requirements = []
        missing_requirements = []
        recommendations = []

        for c_name in ["최지아", "정윤진", "강동현"]:
            if c_name in candidate_names_in_req:
                for r in fallback_data.get("reports", []):
                    if r.get("candidate_name") == c_name:
                        c_fit = r.get("ai_report", {}).get("fit_gap", {})
                        matched_requirements.extend(tag_candidate_items(c_name, c_fit.get("matched_requirements", [])))
                        missing_requirements.extend(tag_candidate_items(c_name, c_fit.get("missing_requirements", [])))
                        recommendations.extend(tag_candidate_items(c_name, c_fit.get("recommendations", [])))
                        break

        if not matched_requirements:
            matched_requirements = ["요구사항에 대략적으로 부합합니다."]
        if not missing_requirements:
            missing_requirements = ["특이 요구사항 부재"]
        if not recommendations:
            recommendations = ["기본 피드백을 참고하세요."]

        fit_gap = {
            "matched_requirements": matched_requirements,
            "missing_requirements": missing_requirements,
            "recommendations": recommendations
        }

        return ReportResponse(
            session_id=request.session_id,
            overall_score=overall_score,
            top_summary=top_summary,
            fit_gap=fit_gap,
            question_reports=matched_qrs
        )

    return report_generator.generate(request)


@router.post("/api/fit-gap", response_model=FitGapAnalysisResponse)
def generate_fit_gap(request: FitGapRequest) -> FitGapAnalysisResponse:
    try:
        return fit_gap_composer.generate(
            job_description=request.job_description,
            interview_session=request.interview_session,
            resume_summary=request.resume_summary,
        )
    except (FitGapComposerUnavailable, ValueError) as exc:
        logger.warning("Fit-Gap Gemini unavailable; using fallback fit-gap endpoint. reason=%s", exc)
        return fit_gap_composer.generate_fallback(
            job_description=request.job_description,
            interview_session=request.interview_session,
            resume_summary=request.resume_summary,
        )


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
    if request.answer_id is None and request.question_id is None:
        raise HTTPException(status_code=400, detail="answer_id or question_id is required.")
    stt_executor.submit(
        stt_service.process_s3_job,
        request.answer_id,
        request.question_id,
        request.audio_key,
        request.callback_url,
        request.bucket,
    )
    return SttJobResponse(
        answer_id=request.answer_id,
        question_id=request.question_id,
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
    if os.getenv("IS_DEMO_MODE", "true").lower() == "true":
        logger.info("Demo mode enabled: Generating fallback session questions.")
        fallback_data = load_fallback_json()
        rec_questions = fallback_data.get("recommended_questions", {})

        personal_questions = []
        for cand in request.candidates:
            c_key = get_candidate_key(cand.name)
            cand_qs = []
            if c_key:
                # Find candidate's questions in fallback
                for p_q in rec_questions.get("personal_questions", []):
                    if p_q.get("candidate_name") == c_key:
                        cand_qs = p_q.get("questions", [])
                        break

            personal_questions.append({
                "candidate_id": cand.candidate_id,
                "questions": cand_qs
            })

        return SessionQuestionGenerationResponse(
            session_type=request.session_type,
            common_questions=rec_questions.get("common_questions", []),
            personal_questions=personal_questions
        )

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
