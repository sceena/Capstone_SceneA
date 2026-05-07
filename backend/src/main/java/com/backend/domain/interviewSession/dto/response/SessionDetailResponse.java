package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public record SessionDetailResponse(
        Long id,
        @JsonProperty("job_category") String jobCategory,
        SessionStatus status,
        @JsonProperty("started_at") LocalDateTime startedAt,
        @JsonProperty("ended_at") LocalDateTime endedAt,
        @JsonProperty("mentor_id") Long mentorId,
        List<ParticipantInfo> participants,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static SessionDetailResponse of(InterviewSession session, List<ParticipantInfo> participants) {
        return new SessionDetailResponse(
                session.getId(),
                session.getJobCategory(),
                session.getStatus(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getMentor().getId(),
                participants,
                session.getCreateDate(),
                session.getModifyDate()
        );
    }
}
