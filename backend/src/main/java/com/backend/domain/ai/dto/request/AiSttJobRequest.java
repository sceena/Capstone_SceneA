package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiSttJobRequest(
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("question_id") Long questionId,
        @JsonProperty("audio_key") String audioKey,
        @JsonProperty("callback_url") String callbackUrl
) {
    public static AiSttJobRequest forAnswer(Long answerId, String audioKey, String callbackUrl) {
        return new AiSttJobRequest(answerId, null, audioKey, callbackUrl);
    }

    public static AiSttJobRequest forQuestion(Long questionId, String audioKey, String callbackUrl) {
        return new AiSttJobRequest(null, questionId, audioKey, callbackUrl);
    }
}
