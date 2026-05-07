package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record SessionCreateResponse(
        Long id,
        @JsonProperty("job_category") String jobCategory,
        SessionStatus status,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static SessionCreateResponse from(InterviewSession session) {
        return new SessionCreateResponse(
                session.getId(),
                session.getJobCategory(),
                session.getStatus(),
                session.getMentor().getId(),
                session.getCreateDate()
        );
    }
}
