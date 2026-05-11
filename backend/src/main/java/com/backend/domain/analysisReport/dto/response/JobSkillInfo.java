package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.jobPosting.entity.JobSkill;
import com.fasterxml.jackson.annotation.JsonProperty;

public record JobSkillInfo(
        @JsonProperty("skill_name") String skillName,
        @JsonProperty("skill_type") String skillType
) {
    public static JobSkillInfo from(JobSkill jobSkill) {
        return new JobSkillInfo(
                jobSkill.getSkill(),
                jobSkill.getSkillType().name().toLowerCase()
        );
    }
}
