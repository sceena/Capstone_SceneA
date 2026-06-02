package com.backend.domain.analysisReport.repository;

import com.backend.domain.analysisReport.entity.MenteeReportFeedback;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MenteeReportFeedbackRepository extends JpaRepository<MenteeReportFeedback, Long> {

    Optional<MenteeReportFeedback> findByInterviewSessionAndMentee(InterviewSession interviewSession, Member mentee);

    List<MenteeReportFeedback> findAllByInterviewSession(InterviewSession interviewSession);

    List<MenteeReportFeedback> findAllByInterviewSessionIn(List<InterviewSession> interviewSessions);
}
