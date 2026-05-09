package com.backend.domain.interviewAnswer.dto.response;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record AnswerDetailResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("question_id") Long questionId,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("stt_text") String sttText,
        @JsonProperty("answer_start") LocalDateTime answerStart,
        @JsonProperty("answer_end") LocalDateTime answerEnd,
        @JsonProperty("ai_score") Float aiScore,
        @JsonProperty("mentor_score") Float mentorScore,
        Float gap,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static AnswerDetailResponse from(InterviewAnswer answer, Long sessionId) {
        return new AnswerDetailResponse(
                answer.getId(),
                sessionId,
                answer.getInterviewQuestion().getId(),
                answer.getMember().getId(),
                answer.getSttText(),
                answer.getAnswerStart(),
                answer.getAnswerEnd(),
                answer.getAiScore(),
                answer.getMentorScore(),
                answer.getGap(),
                answer.getCreateDate()
        );
    }
}
