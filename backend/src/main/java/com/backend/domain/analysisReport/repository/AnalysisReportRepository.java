package com.backend.domain.analysisReport.repository;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.interviewSession.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnalysisReportRepository extends JpaRepository<AnalysisReport, Long> {

    Optional<AnalysisReport> findByInterviewSession(InterviewSession interviewSession);

    List<AnalysisReport> findAllByInterviewSessionIn(List<InterviewSession> sessions);
}
