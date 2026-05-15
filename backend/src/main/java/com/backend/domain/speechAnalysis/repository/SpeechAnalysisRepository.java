package com.backend.domain.speechAnalysis.repository;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.speechAnalysis.entity.SpeechAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpeechAnalysisRepository extends JpaRepository<SpeechAnalysis, Long> {

    Optional<SpeechAnalysis> findByInterviewAnswer(InterviewAnswer interviewAnswer);
}
