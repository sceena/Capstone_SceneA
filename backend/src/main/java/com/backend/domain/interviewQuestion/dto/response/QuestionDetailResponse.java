package com.backend.domain.interviewQuestion.dto.response;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record QuestionDetailResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        String content,
        @JsonProperty("question_type") String questionType,
        @JsonProperty("candidate_id") Long candidateId,
        @JsonProperty("stt_status") String sttStatus,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public QuestionDetailResponse(Long id, Long sessionId, String content, String sttStatus, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, sessionId, content, null, null, sttStatus, createdAt, updatedAt);
    }

    public static QuestionDetailResponse from(InterviewQuestion question) {
        return new QuestionDetailResponse(
                question.getId(),
                question.getInterviewSession().getId(),
                question.getContent(),
                question.getQuestionType(),
                question.getCandidateId(),
                question.getSttStatus() == null ? null : question.getSttStatus().name(),
                question.getCreateDate(),
                question.getModifyDate()
        );
    }
}
