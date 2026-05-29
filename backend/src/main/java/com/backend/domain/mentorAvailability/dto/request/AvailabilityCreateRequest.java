package com.backend.domain.mentorAvailability.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record AvailabilityCreateRequest(
        @JsonProperty("start_time") LocalDateTime startTime,
        @JsonProperty("end_time") LocalDateTime endTime
) {}
