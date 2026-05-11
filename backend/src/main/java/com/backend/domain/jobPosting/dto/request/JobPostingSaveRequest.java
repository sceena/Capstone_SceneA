package com.backend.domain.jobPosting.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record JobPostingSaveRequest(
        @NotBlank String company,
        @NotBlank @JsonProperty("job_category") String jobCategory,
        @NotBlank @JsonProperty("raw_text") String rawText,
        String url
) {}
