package com.backend.domain.resume.dto.response;

import com.backend.domain.resume.entity.ResumeSkill;
import com.fasterxml.jackson.annotation.JsonProperty;

public record ResumeSkillDetailInfo(
        Long id,
        @JsonProperty("skill_name") String skillName
) {
    public static ResumeSkillDetailInfo from(ResumeSkill resumeSkill) {
        return new ResumeSkillDetailInfo(
                resumeSkill.getId(),
                resumeSkill.getSkill()
        );
    }
}
