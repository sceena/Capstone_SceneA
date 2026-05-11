package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.resume.entity.ResumeSkill;
import com.fasterxml.jackson.annotation.JsonProperty;

public record ResumeSkillInfo(
        @JsonProperty("skill_name") String skillName
) {
    public static ResumeSkillInfo from(ResumeSkill resumeSkill) {
        return new ResumeSkillInfo(resumeSkill.getSkill());
    }
}
