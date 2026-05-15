package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiMetricsSummaryResponse(
        @JsonProperty("speaking_speed") String speakingSpeed,
        String silence,
        @JsonProperty("sentence_clarity") String sentenceClarity,
        @JsonProperty("star_structure") String starStructure
) {
}
