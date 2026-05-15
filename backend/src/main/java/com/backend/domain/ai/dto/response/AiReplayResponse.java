package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiReplayResponse(
        @JsonProperty("audio_url") String audioUrl,
        @JsonProperty("start_time") String startTime,
        @JsonProperty("end_time") String endTime
) {
}
