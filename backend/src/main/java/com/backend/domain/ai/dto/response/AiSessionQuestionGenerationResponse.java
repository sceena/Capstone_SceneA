package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiSessionQuestionGenerationResponse(
        @JsonProperty("session_type") String sessionType,
        @JsonProperty("common_questions") List<String> commonQuestions,
        @JsonProperty("personal_questions") List<AiPersonalQuestionResponse> personalQuestions
) {
}
