package com.backend.domain.reservation.dto.response;

import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ReservationSummaryResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("mentee_name") String menteeName,
        @JsonProperty("availability_id") Long availabilityId,
        @JsonProperty("scheduled_at") LocalDateTime scheduledAt,
        @JsonProperty("max_participants") int maxParticipants,
        ReservationStatus status,
        @JsonProperty("resume_content") String resumeContent,
        @JsonProperty("request_note") String requestNote,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static ReservationSummaryResponse from(Reservation reservation) {
        return new ReservationSummaryResponse(
                reservation.getId(),
                reservation.getInterviewSession() != null ? reservation.getInterviewSession().getId() : null,
                reservation.getMentee().getId(),
                reservation.getMentee().getName(),
                reservation.getMentorAvailability().getId(),
                reservation.getMentorAvailability().getStartTime(),
                reservation.getMentorAvailability().getMaxParticipants(),
                reservation.getStatus(),
                reservation.getResumeContent(),
                reservation.getRequestNote(),
                reservation.getCreateDate()
        );
    }
}
