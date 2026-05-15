package com.backend.domain.resume.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "resume_skill")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ResumeSkill extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id", nullable = false)
    private Resume resume;

    @Column(nullable = false)
    private String skill;

    @Builder
    public ResumeSkill(Resume resume, String skill) {
        this.resume = resume;
        this.skill = skill;
    }
}
