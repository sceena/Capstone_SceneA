package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiInterviewAnswerRequest(
        @JsonProperty("question_id") Long questionId,
        String question,
        @JsonProperty("answer_id") Long answerId,
        String answer,
        @JsonProperty("audio_url") String audioUrl,
        @JsonProperty("answer_start") String answerStart,
        @JsonProperty("answer_end") String answerEnd,
        AiAnswerMetricsRequest metrics
) {
}
