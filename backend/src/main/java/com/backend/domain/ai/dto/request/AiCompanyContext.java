package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AiCompanyContext(
        @JsonProperty("target_company") String targetCompany,
        @JsonProperty("target_role") String targetRole,
        @JsonProperty("job_posting_summary") String jobPostingSummary,
        @JsonProperty("job_posting_url") String jobPostingUrl
) {
}
