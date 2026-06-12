package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiFitGapResponse(
        @JsonProperty("matched_requirements") List<String> matchedRequirements,
        @JsonProperty("missing_requirements") List<String> missingRequirements,
        @JsonProperty("recommendations") List<String> recommendations
) {
}
