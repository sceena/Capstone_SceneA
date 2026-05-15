package com.backend.domain.jobPosting.repository;

import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.entity.JobSkill;
import com.backend.domain.jobPosting.entity.SkillType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {

    List<JobSkill> findAllByJobPosting(JobPosting jobPosting);

    List<JobSkill> findAllByJobPostingAndSkillType(JobPosting jobPosting, SkillType skillType);
}
