package com.backend.domain.analysisReport.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record MentorFeedbackRequest(
        @NotBlank @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("mentor_score") Float mentorScore,
        @Valid @JsonProperty("answer_evaluations") List<MentorAnswerEvaluationPayload> answerEvaluations
) {
    public record MentorAnswerEvaluationPayload(
            @NotNull @JsonProperty("answer_id") Long answerId,
            @NotBlank String reasoning,
            @NotNull
            @DecimalMin("1.0")
            @DecimalMax("10.0")
            Float score,
            List<String> strengths,
            List<String> improvements
    ) {}

    public MentorFeedbackRequest(String mentorFeedback, Float mentorScore) {
        this(mentorFeedback, mentorScore, List.of());
    }
}
