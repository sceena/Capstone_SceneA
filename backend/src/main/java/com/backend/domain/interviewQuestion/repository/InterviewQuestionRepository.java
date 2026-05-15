package com.backend.domain.interviewQuestion.repository;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewSession.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, Long> {

    List<InterviewQuestion> findAllByInterviewSessionOrderByOrderIndex(InterviewSession interviewSession);
}
