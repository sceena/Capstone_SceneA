package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public record SessionSummaryResponse(
        Long id,
        String title,
        @JsonProperty("job_category") String jobCategory,
        SessionStatus status,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("mentor_name") String mentorName,
        @JsonProperty("mentee_name") String menteeName,
        @JsonProperty("session_type") String sessionType,
        @JsonProperty("scheduled_at") LocalDateTime scheduledAt,
        @JsonProperty("started_at") LocalDateTime startedAt,
        @JsonProperty("ended_at") LocalDateTime endedAt
) {
    public static SessionSummaryResponse from(InterviewSession session) {
        return from(session, List.of());
    }

    public static SessionSummaryResponse from(InterviewSession session, List<SessionParticipant> participants) {
        String title = session.getJobCategory() != null && !session.getJobCategory().isBlank()
                ? session.getJobCategory() + " 모의 면접"
                : "모의 면접";
        String menteeName = participants.stream()
                .filter(p -> !p.getMember().getId().equals(session.getMentor().getId()))
                .map(p -> p.getMember().getName())
                .findFirst()
                .orElse(null);
        return new SessionSummaryResponse(
                session.getId(),
                title,
                session.getJobCategory(),
                session.getStatus(),
                session.getMentor().getId(),
                session.getMentor().getName(),
                menteeName,
                "1:1 면접",
                session.getScheduledAt(),
                session.getStartedAt(),
                session.getEndedAt()
        );
    }
}
