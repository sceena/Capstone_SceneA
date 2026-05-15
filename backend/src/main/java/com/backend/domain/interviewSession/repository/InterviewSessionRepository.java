package com.backend.domain.interviewSession.repository;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.member.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, Long> {

    Page<InterviewSession> findAllByMentor(Member mentor, Pageable pageable);

    Page<InterviewSession> findAllByMentorAndStatus(Member mentor, SessionStatus status, Pageable pageable);
}
