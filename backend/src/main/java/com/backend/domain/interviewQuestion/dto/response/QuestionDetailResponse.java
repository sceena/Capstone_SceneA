package com.backend.domain.interviewQuestion.dto.response;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record QuestionDetailResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        String content,
        @JsonProperty("stt_status") String sttStatus,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static QuestionDetailResponse from(InterviewQuestion question) {
        return new QuestionDetailResponse(
                question.getId(),
                question.getInterviewSession().getId(),
                question.getContent(),
                question.getSttStatus() == null ? null : question.getSttStatus().name(),
                question.getCreateDate(),
                question.getModifyDate()
        );
    }
}
