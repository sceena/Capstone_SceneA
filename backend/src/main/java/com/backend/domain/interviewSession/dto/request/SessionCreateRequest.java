package com.backend.domain.interviewSession.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SessionCreateRequest(
        @JsonProperty("job_posting_id") Long jobPostingId,
        @JsonProperty("resume_id") Long resumeId,
        @JsonProperty("job_category") String jobCategory,
        @JsonProperty("mentor_id") Long mentorId
) {}
