package com.backend.domain.reservation.dto.response;

import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ReservationResponse(
        Long id,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("availability_id") Long availabilityId,
        ReservationStatus status,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static ReservationResponse from(Reservation reservation) {
        return new ReservationResponse(
                reservation.getId(),
                reservation.getMentorAvailability().getMentor().getId(),
                reservation.getMentorAvailability().getId(),
                reservation.getStatus(),
                reservation.getCreateDate()
        );
    }
}
