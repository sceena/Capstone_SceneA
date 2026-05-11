package com.backend.domain.jobPosting.dto.response;

import com.backend.domain.jobPosting.entity.JobSkill;
import com.fasterxml.jackson.annotation.JsonProperty;

public record JobSkillDetailInfo(
        Long id,
        @JsonProperty("skill_name") String skillName,
        @JsonProperty("skill_type") String skillType
) {
    public static JobSkillDetailInfo from(JobSkill jobSkill) {
        return new JobSkillDetailInfo(
                jobSkill.getId(),
                jobSkill.getSkill(),
                jobSkill.getSkillType().name().toLowerCase()
        );
    }
}
