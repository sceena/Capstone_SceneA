package com.backend.domain.answerEvaluation.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record MentorEvaluationRequest(
        @NotBlank String reasoning,
        @NotNull
        @DecimalMin("1.0")
        @DecimalMax("10.0")
        Float score,
        List<String> strengths,
        List<String> improvements
) {
    public MentorEvaluationRequest(
            @JsonProperty("reasoning") String reasoning,
            @JsonProperty("score") Float score,
            @JsonProperty("strengths") List<String> strengths,
            @JsonProperty("improvements") List<String> improvements
    ) {
        this.reasoning = reasoning;
        this.score = score;
        this.strengths = strengths;
        this.improvements = improvements;
    }
}
