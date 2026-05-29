package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiSttJobRequest(
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("audio_key") String audioKey,
        @JsonProperty("callback_url") String callbackUrl
) {
}
