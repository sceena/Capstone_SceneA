from pydantic import BaseModel, Field


class CandidateContext(BaseModel):
    candidate_id: int | None = None
    name: str | None = None
    level: str | None = None
    target_role: str | None = None
    resume_summaries: list[str] = Field(default_factory=list)


class CompanyContext(BaseModel):
    target_company: str | None = None
    target_role: str | None = None
    job_posting_summary: str | None = None
    job_posting_url: str | None = None


class AnswerMetrics(BaseModel):
    duration_sec: int | None = None
    speaking_speed: str | None = None
    silence: str | None = None
    sentence_clarity: str | None = None
    star_structure: str | None = None


class InterviewAnswer(BaseModel):
    question_id: int
    question: str
    answer_id: int | None = None
    answer: str | None = None
    audio_url: str | None = None
    answer_start: str | None = None
    answer_end: str | None = None
    metrics: AnswerMetrics | None = None


class ReportRequest(BaseModel):
    session_id: int
    candidate_context: CandidateContext
    company_context: CompanyContext
    interview_answers: list[InterviewAnswer]


class MetricsSummary(BaseModel):
    speaking_speed: str
    silence: str
    sentence_clarity: str
    star_structure: str


class QuestionHighlight(BaseModel):
    question_id: int
    question: str
    reason: str
    metrics_summary: MetricsSummary


class TopSummary(BaseModel):
    best_question: QuestionHighlight
    worst_question: QuestionHighlight


class FitGap(BaseModel):
    matched_requirements: list[str]
    missing_requirements: list[str]
    recommendations: list[str]


class Replay(BaseModel):
    audio_url: str | None = None
    start_time: str | None = None
    end_time: str | None = None


class QuestionReport(BaseModel):
    question_id: int
    question: str
    answer: str
    score: float
    strengths: list[str]
    improvements: list[str]
    replay: Replay


class ReportResponse(BaseModel):
    session_id: int
    overall_score: float
    top_summary: TopSummary
    fit_gap: FitGap
    question_reports: list[QuestionReport]
