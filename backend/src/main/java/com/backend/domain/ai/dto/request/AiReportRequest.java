package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiReportRequest(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("candidate_context") AiCandidateContext candidateContext,
        @JsonProperty("company_context") AiCompanyContext companyContext,
        @JsonProperty("interview_answers") List<AiInterviewAnswerRequest> interviewAnswers
) {
}
