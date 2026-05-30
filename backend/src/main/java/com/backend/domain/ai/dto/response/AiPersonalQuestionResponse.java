package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiPersonalQuestionResponse(
        @JsonProperty("candidate_id") Long candidateId,
        List<String> questions
) {
}
