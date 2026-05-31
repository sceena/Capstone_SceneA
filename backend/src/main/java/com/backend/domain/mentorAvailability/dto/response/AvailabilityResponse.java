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
        @JsonProperty("max_participants") int maxParticipants,
        @JsonProperty("current_participants") int currentParticipants
) {
    public static AvailabilityResponse from(MentorAvailability availability, long currentParticipants) {
        return new AvailabilityResponse(
                availability.getId(),
                availability.getMentor().getId(),
                availability.getStartTime(),
                availability.getEndTime(),
                availability.isBooked(),
                availability.getMaxParticipants(),
                (int) currentParticipants
        );
    }

    public static AvailabilityResponse from(MentorAvailability availability) {
        return from(availability, 0);
    }
}
