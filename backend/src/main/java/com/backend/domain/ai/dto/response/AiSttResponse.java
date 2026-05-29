package com.backend.domain.ai.dto.response;

import com.backend.domain.interviewAnswer.entity.AudioQualityStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

public record AiSttResponse(
        String text,
        String model,
        String language,
        @JsonProperty("duration_sec") Float durationSec,
        @JsonProperty("audio_quality_status") AudioQualityStatus audioQualityStatus,
        @JsonProperty("audio_quality_message") String audioQualityMessage
) {
}
