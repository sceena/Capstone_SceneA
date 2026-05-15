package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiQuestionHighlightResponse(
        @JsonProperty("question_id") Long questionId,
        String question,
        String reason,
        @JsonProperty("metrics_summary") AiMetricsSummaryResponse metricsSummary
) {
}
