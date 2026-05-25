package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiSttJobResponse(
        @JsonProperty("answer_id") Long answerId,
        String status,
        String message
) {
}
