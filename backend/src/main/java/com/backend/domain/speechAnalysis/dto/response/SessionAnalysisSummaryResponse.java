package com.backend.domain.speechAnalysis.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record SessionAnalysisSummaryResponse(
        @JsonProperty("session_id") Long sessionId,
        List<AnswerSummaryItem> answers,
        @JsonProperty("best_answer_id") Long bestAnswerId,
        @JsonProperty("worst_answer_id") Long worstAnswerId
) {
    public record AnswerSummaryItem(
            @JsonProperty("answer_id") Long answerId,
            @JsonProperty("ai_score") Float aiScore,
            Float wpm,
            @JsonProperty("star_ratio") Float starRatio
    ) {}
}
