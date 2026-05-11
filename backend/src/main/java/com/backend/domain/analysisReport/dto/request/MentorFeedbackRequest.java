package com.backend.domain.analysisReport.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record MentorFeedbackRequest(
        @NotBlank @JsonProperty("mentor_feedback") String mentorFeedback
) {}
