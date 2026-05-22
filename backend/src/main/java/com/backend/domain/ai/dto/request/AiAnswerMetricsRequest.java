package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiAnswerMetricsRequest(
        @JsonProperty("duration_sec") Long durationSec,
        @JsonProperty("speaking_speed") String speakingSpeed,
        String silence,
        @JsonProperty("sentence_clarity") String sentenceClarity,
        @JsonProperty("star_structure") String starStructure
) {
}
