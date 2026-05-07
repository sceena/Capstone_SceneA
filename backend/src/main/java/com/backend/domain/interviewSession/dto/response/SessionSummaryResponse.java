package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record SessionSummaryResponse(
        Long id,
        @JsonProperty("job_category") String jobCategory,
        SessionStatus status,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("started_at") LocalDateTime startedAt,
        @JsonProperty("ended_at") LocalDateTime endedAt
) {
    public static SessionSummaryResponse from(InterviewSession session) {
        return new SessionSummaryResponse(
                session.getId(),
                session.getJobCategory(),
                session.getStatus(),
                session.getMentor().getId(),
                session.getStartedAt(),
                session.getEndedAt()
        );
    }
}
