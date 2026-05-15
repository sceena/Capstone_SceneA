package com.backend.domain.jobPosting.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "job_skill")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class JobSkill extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_posting_id", nullable = false)
    private JobPosting jobPosting;

    @Column(nullable = false)
    private String skill;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SkillType skillType;

    @Builder
    public JobSkill(JobPosting jobPosting, String skill, SkillType skillType) {
        this.jobPosting = jobPosting;
        this.skill = skill;
        this.skillType = skillType;
    }
}
