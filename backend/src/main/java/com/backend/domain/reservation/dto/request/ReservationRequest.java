package com.backend.domain.reservation.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReservationRequest(
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("availability_id") Long availabilityId,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("job_posting_id") Long jobPostingId,
        @JsonProperty("resume_content") String resumeContent,
        @JsonProperty("request_note") String requestNote
) {
    public ReservationRequest(Long mentorId, Long availabilityId, Long sessionId, Long jobPostingId) {
        this(mentorId, availabilityId, sessionId, jobPostingId, null, null);
    }
}
