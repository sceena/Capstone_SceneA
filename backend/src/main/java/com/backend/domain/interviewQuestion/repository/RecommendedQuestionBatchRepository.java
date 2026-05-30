package com.backend.domain.interviewQuestion.repository;

import com.backend.domain.interviewQuestion.entity.RecommendedQuestionBatch;
import com.backend.domain.interviewSession.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RecommendedQuestionBatchRepository extends JpaRepository<RecommendedQuestionBatch, Long> {

    Optional<RecommendedQuestionBatch> findByInterviewSession(InterviewSession interviewSession);
}
