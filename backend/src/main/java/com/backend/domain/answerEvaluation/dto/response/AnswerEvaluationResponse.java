package com.backend.domain.answerEvaluation.dto.response;

import com.backend.domain.answerEvaluation.entity.AnswerEvaluation;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public record AnswerEvaluationResponse(
        Long id,
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("question_text") String questionText,
        @JsonProperty("answer_text") String answerText,
        @JsonProperty("ai_reasoning") String aiReasoning,
        @JsonProperty("ai_score") Float aiScore,
        @JsonProperty("ai_strengths") List<String> aiStrengths,
        @JsonProperty("ai_improvements") List<String> aiImprovements,
        @JsonProperty("mentor_reasoning") String mentorReasoning,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("mentor_strengths") List<String> mentorStrengths,
        @JsonProperty("mentor_improvements") List<String> mentorImprovements,
        @JsonProperty("ai_model_name") String aiModelName,
        @JsonProperty("prompt_version") String promptVersion,
        @JsonProperty("evaluation_source") String evaluationSource,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static AnswerEvaluationResponse from(AnswerEvaluation evaluation, EvaluationJsonMapper jsonMapper) {
        return new AnswerEvaluationResponse(
                evaluation.getId(),
                evaluation.getInterviewAnswer().getId(),
                evaluation.getQuestionText(),
                evaluation.getAnswerText(),
                evaluation.getAiReasoning(),
                evaluation.getAiScore(),
                jsonMapper.fromJson(evaluation.getAiStrengthsJson()),
                jsonMapper.fromJson(evaluation.getAiImprovementsJson()),
                evaluation.getMentorReasoning(),
                evaluation.getMentorScore(),
                jsonMapper.fromJson(evaluation.getMentorStrengthsJson()),
                jsonMapper.fromJson(evaluation.getMentorImprovementsJson()),
                evaluation.getAiModelName(),
                evaluation.getPromptVersion(),
                evaluation.getEvaluationSource(),
                evaluation.getCreateDate(),
                evaluation.getModifyDate()
        );
    }
}
