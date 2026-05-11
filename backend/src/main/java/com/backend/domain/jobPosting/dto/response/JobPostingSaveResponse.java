package com.backend.domain.jobPosting.dto.response;

import com.backend.domain.jobPosting.entity.JobPosting;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record JobPostingSaveResponse(
        Long id,
        String company,
        @JsonProperty("job_category") String jobCategory,
        @JsonProperty("raw_text") String rawText,
        String url,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static JobPostingSaveResponse from(JobPosting jobPosting) {
        return new JobPostingSaveResponse(
                jobPosting.getId(),
                jobPosting.getCompany(),
                jobPosting.getJobCategory(),
                jobPosting.getRawText(),
                jobPosting.getUrl(),
                jobPosting.getInterviewSession().getId(),
                jobPosting.getCreateDate()
        );
    }
}
