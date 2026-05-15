package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record SessionJoinResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("user_id") Long userId,
        @JsonProperty("answer_status") AnswerStatus answerStatus,
        @JsonProperty("joined_at") LocalDateTime joinedAt
) {
    public static SessionJoinResponse from(SessionParticipant participant) {
        return new SessionJoinResponse(
                participant.getInterviewSession().getId(),
                participant.getMember().getId(),
                participant.getAnswerStatus(),
                participant.getCreateDate()
        );
    }
}
