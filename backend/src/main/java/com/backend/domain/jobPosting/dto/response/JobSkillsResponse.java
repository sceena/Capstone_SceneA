package com.backend.domain.jobPosting.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record JobSkillsResponse(
        @JsonProperty("job_posting_id") Long jobPostingId,
        List<JobSkillDetailInfo> skills
) {}
