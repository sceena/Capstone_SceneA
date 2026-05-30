package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiQuestionCandidateRequest(
        @JsonProperty("candidate_id") Long candidateId,
        String name,
        String content
) {
}
