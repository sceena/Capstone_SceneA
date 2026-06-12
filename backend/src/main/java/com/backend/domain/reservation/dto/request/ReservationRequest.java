package com.backend.domain.reservation.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReservationRequest(
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("availability_id") Long availabilityId,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("job_posting_id") Long jobPostingId,
        @JsonProperty("resume_content") String resumeContent,
        @JsonProperty("request_note") String requestNote,
        @JsonProperty("job_posting_raw_text") String jobPostingRawText,
        @JsonProperty("job_posting_url") String jobPostingUrl,
        @JsonProperty("job_posting_company") String jobPostingCompany,
        @JsonProperty("job_posting_job_category") String jobPostingJobCategory
) {
    public ReservationRequest(Long mentorId, Long availabilityId, Long sessionId, Long jobPostingId) {
        this(mentorId, availabilityId, sessionId, jobPostingId, null, null, null, null, null, null);
    }

    public ReservationRequest(Long mentorId, Long availabilityId, Long sessionId, Long jobPostingId, String resumeContent) {
        this(mentorId, availabilityId, sessionId, jobPostingId, resumeContent, null, null, null, null, null);
    }

    public ReservationRequest(
            Long mentorId,
            Long availabilityId,
            Long sessionId,
            Long jobPostingId,
            String resumeContent,
            String requestNote
    ) {
        this(mentorId, availabilityId, sessionId, jobPostingId, resumeContent, requestNote, null, null, null, null);
    }
}
