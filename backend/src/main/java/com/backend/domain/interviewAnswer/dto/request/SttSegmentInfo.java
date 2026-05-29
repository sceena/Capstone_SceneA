package com.backend.domain.interviewAnswer.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SttSegmentInfo(
        @JsonProperty("start_sec") Float startSec,
        @JsonProperty("end_sec") Float endSec,
        String text
) {
}
