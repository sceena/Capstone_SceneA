package com.backend.domain.jobPosting.repository;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.jobPosting.entity.JobPosting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {

    Optional<JobPosting> findByInterviewSession(InterviewSession interviewSession);
}
