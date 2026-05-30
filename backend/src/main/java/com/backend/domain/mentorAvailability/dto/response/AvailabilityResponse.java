package com.backend.domain.mentorAvailability.dto.response;

import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record AvailabilityResponse(
        Long id,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("start_time") LocalDateTime startTime,
        @JsonProperty("end_time") LocalDateTime endTime,
        @JsonProperty("is_booked") boolean isBooked,
        @JsonProperty("max_participants") int maxParticipants
) {
    public AvailabilityResponse(
            Long id,
            Long mentorId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            boolean isBooked
    ) {
        this(id, mentorId, startTime, endTime, isBooked, 1);
    }

    public static AvailabilityResponse from(MentorAvailability availability) {
        return new AvailabilityResponse(
                availability.getId(),
                availability.getMentor().getId(),
                availability.getStartTime(),
                availability.getEndTime(),
                availability.isBooked(),
                availability.getMaxParticipants()
        );
    }
}
