package com.backend.domain.reservation.dto.response;

import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record MenteeReservationResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("mentor_name") String mentorName,
        @JsonProperty("availability_id") Long availabilityId,
        @JsonProperty("scheduled_at") LocalDateTime scheduledAt,
        ReservationStatus status,
        @JsonProperty("session_status") SessionStatus sessionStatus,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static MenteeReservationResponse from(Reservation reservation) {
        SessionStatus sessionStatus = reservation.getInterviewSession() != null
                ? reservation.getInterviewSession().getStatus()
                : null;
        return new MenteeReservationResponse(
                reservation.getId(),
                reservation.getInterviewSession() != null ? reservation.getInterviewSession().getId() : null,
                reservation.getMentorAvailability().getMentor().getId(),
                reservation.getMentorAvailability().getMentor().getName(),
                reservation.getMentorAvailability().getId(),
                reservation.getMentorAvailability().getStartTime(),
                reservation.getStatus(),
                sessionStatus,
                reservation.getCreateDate()
        );
    }
}
