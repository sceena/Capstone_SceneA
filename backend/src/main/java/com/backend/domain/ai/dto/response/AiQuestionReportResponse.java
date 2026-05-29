package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiQuestionReportResponse(
        @JsonProperty("question_id") Long questionId,
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("mentee_name") String menteeName,
        String question,
        String answer,
        Float score,
        String reasoning,
        List<String> strengths,
        List<String> improvements,
        @JsonProperty("evaluation_source") String evaluationSource,
        @JsonProperty("ai_model_name") String aiModelName,
        @JsonProperty("prompt_version") String promptVersion,
        AiReplayResponse replay
) {
}
