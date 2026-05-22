package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiTopSummaryResponse(
        @JsonProperty("best_question") AiQuestionHighlightResponse bestQuestion,
        @JsonProperty("worst_question") AiQuestionHighlightResponse worstQuestion
) {
}
