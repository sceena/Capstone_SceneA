package com.backend.domain.interviewAnswer.dto.request;

import com.backend.domain.interviewAnswer.entity.AudioQualityStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record SttCallbackRequest(
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("question_id") Long questionId,
        String status,
        String text,
        String model,
        String language,
        @JsonProperty("duration_sec") Float durationSec,
        @JsonProperty("audio_quality_status") AudioQualityStatus audioQualityStatus,
        @JsonProperty("audio_quality_message") String audioQualityMessage,
        @JsonProperty("error_message") String errorMessage,
        List<SttSegmentInfo> segments
) {
}
