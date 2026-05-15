package com.backend.domain.resume.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record ResumeSkillsResponse(
        @JsonProperty("resume_id") Long resumeId,
        List<ResumeSkillDetailInfo> skills
) {}
