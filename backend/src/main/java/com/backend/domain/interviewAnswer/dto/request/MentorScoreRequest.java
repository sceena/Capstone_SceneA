package com.backend.domain.interviewAnswer.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MentorScoreRequest(
        @JsonProperty("mentor_score") Float mentorScore
) {
}
