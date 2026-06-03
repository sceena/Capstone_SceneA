package com.backend.domain.analysisReport.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record MentorFeedbackRequest(
        @NotBlank @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("mentee_name") String menteeName,
        @Valid @JsonProperty("answer_evaluations") List<MentorAnswerEvaluationPayload> answerEvaluations
) {
    public record MentorAnswerEvaluationPayload(
            @JsonProperty("answer_id") Long answerId,
            @JsonProperty("question_id") Long questionId,
            @JsonProperty("mentee_id") Long menteeId,
            @JsonProperty("mentee_name") String menteeName,
            @JsonProperty("question_text") String questionText,
            @JsonProperty("answer_text") String answerText,
            @NotBlank String reasoning,
            @DecimalMin("1.0")
            @DecimalMax("5.0")
            Float score,
            List<String> strengths,
            List<String> improvements
    ) {}

    public MentorFeedbackRequest(String mentorFeedback, Float mentorScore) {
        this(mentorFeedback, mentorScore, null, null, List.of());
    }
}
