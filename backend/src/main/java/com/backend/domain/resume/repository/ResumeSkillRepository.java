package com.backend.domain.resume.repository;

import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.entity.ResumeSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResumeSkillRepository extends JpaRepository<ResumeSkill, Long> {

    List<ResumeSkill> findAllByResume(Resume resume);
}
