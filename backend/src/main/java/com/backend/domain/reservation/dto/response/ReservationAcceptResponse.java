package com.backend.domain.reservation.dto.response;

import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ReservationAcceptResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        ReservationStatus status,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static ReservationAcceptResponse from(Reservation reservation) {
        return new ReservationAcceptResponse(
                reservation.getId(),
                reservation.getInterviewSession() != null ? reservation.getInterviewSession().getId() : null,
                reservation.getStatus(),
                reservation.getModifyDate()
        );
    }
}
