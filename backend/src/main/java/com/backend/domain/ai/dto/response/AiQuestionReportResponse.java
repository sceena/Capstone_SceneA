package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiQuestionReportResponse(
        @JsonProperty("question_id") Long questionId,
        String question,
        String answer,
        Float score,
        List<String> strengths,
        List<String> improvements,
        AiReplayResponse replay
) {
}
