package com.backend.domain.reservation.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReservationRequest(
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("availability_id") Long availabilityId,
        @JsonProperty("job_posting_id") Long jobPostingId
) {}
