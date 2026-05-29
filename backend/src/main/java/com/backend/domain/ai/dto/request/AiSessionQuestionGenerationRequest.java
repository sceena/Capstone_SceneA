package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiSessionQuestionGenerationRequest(
        @JsonProperty("session_type") String sessionType,
        List<AiQuestionCandidateRequest> candidates
) {
}
