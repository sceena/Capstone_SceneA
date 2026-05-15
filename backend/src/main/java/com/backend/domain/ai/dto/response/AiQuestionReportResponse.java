package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiQuestionReportResponse(
        @JsonProperty("question_id") Long questionId,
        String question,
        String answer,
        Float score,
        String reasoning,
        List<String> strengths,
        List<String> improvements,
        @JsonProperty("evaluation_source") String evaluationSource,
        AiReplayResponse replay
) {
}
