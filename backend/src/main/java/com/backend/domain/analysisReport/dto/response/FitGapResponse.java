package com.backend.domain.analysisReport.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record FitGapResponse(
        @JsonProperty("report_id") Long reportId,
        @JsonProperty("job_skills") List<JobSkillInfo> jobSkills,
        @JsonProperty("resume_skills") List<ResumeSkillInfo> resumeSkills,
        List<String> matched,
        List<String> unmatched
) {
}
