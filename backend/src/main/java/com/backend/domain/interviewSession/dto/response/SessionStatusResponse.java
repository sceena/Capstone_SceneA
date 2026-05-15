package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record SessionStatusResponse(
        Long id,
        SessionStatus status,
        @JsonProperty("started_at") LocalDateTime startedAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static SessionStatusResponse from(InterviewSession session) {
        return new SessionStatusResponse(
                session.getId(),
                session.getStatus(),
                session.getStartedAt(),
                session.getModifyDate()
        );
    }
}
