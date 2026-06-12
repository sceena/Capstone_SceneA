from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class CandidateContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    candidate_id: int | None = Field(default=None, validation_alias=AliasChoices("candidate_id", "candidateId"))
    name: str | None = None
    level: str | None = None
    target_role: str | None = Field(default=None, validation_alias=AliasChoices("target_role", "targetRole"))
    resume_summaries: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("resume_summaries", "resumeSummaries"),
    )


class CompanyContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_company: str | None = Field(default=None, validation_alias=AliasChoices("target_company", "targetCompany"))
    target_role: str | None = Field(default=None, validation_alias=AliasChoices("target_role", "targetRole"))
    job_posting_summary: str | None = Field(
        default=None,
        validation_alias=AliasChoices("job_posting_summary", "jobPostingSummary"),
    )
    job_posting_url: str | None = Field(default=None, validation_alias=AliasChoices("job_posting_url", "jobPostingUrl"))


class AnswerMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    duration_sec: int | None = Field(default=None, validation_alias=AliasChoices("duration_sec", "durationSec"))
    speaking_speed: str | None = Field(default=None, validation_alias=AliasChoices("speaking_speed", "speakingSpeed"))
    silence: str | None = None
    sentence_clarity: str | None = Field(
        default=None,
        validation_alias=AliasChoices("sentence_clarity", "sentenceClarity"),
    )
    star_structure: str | None = Field(default=None, validation_alias=AliasChoices("star_structure", "starStructure"))


class InterviewAnswer(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question_id: int = Field(validation_alias=AliasChoices("question_id", "questionId"))
    question: str
    answer_id: int | None = Field(default=None, validation_alias=AliasChoices("answer_id", "answerId"))
    mentee_id: int | None = Field(default=None, validation_alias=AliasChoices("mentee_id", "menteeId"))
    mentee_name: str | None = Field(default=None, validation_alias=AliasChoices("mentee_name", "menteeName"))
    answer: str | None = None
    audio_url: str | None = Field(default=None, validation_alias=AliasChoices("audio_url", "audioUrl"))
    answer_start: str | None = Field(default=None, validation_alias=AliasChoices("answer_start", "answerStart"))
    answer_end: str | None = Field(default=None, validation_alias=AliasChoices("answer_end", "answerEnd"))
    metrics: AnswerMetrics | None = None


class ReportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: int = Field(validation_alias=AliasChoices("session_id", "sessionId"))
    candidate_context: CandidateContext = Field(validation_alias=AliasChoices("candidate_context", "candidateContext"))
    company_context: CompanyContext = Field(validation_alias=AliasChoices("company_context", "companyContext"))
    interview_answers: list[InterviewAnswer] = Field(
        validation_alias=AliasChoices("interview_answers", "interviewAnswers"),
    )


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
    answer_id: int | None = None
    mentee_id: int | None = None
    mentee_name: str | None = None
    question: str
    answer: str
    score: float
    reasoning: str
    strengths: list[str]
    improvements: list[str]
    evaluation_source: str
    ai_model_name: str
    prompt_version: str
    replay: Replay


class ReportResponse(BaseModel):
    session_id: int
    overall_score: float
    top_summary: TopSummary
    fit_gap: FitGap
    question_reports: list[QuestionReport]
