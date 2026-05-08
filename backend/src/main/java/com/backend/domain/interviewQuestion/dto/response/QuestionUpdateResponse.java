package com.backend.domain.interviewQuestion.dto.response;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record QuestionUpdateResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        String content,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static QuestionUpdateResponse from(InterviewQuestion question) {
        return new QuestionUpdateResponse(
                question.getId(),
                question.getInterviewSession().getId(),
                question.getContent(),
                question.getModifyDate()
        );
    }
}
