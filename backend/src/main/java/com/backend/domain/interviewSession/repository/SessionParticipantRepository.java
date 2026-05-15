package com.backend.domain.interviewSession.repository;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.member.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {

    List<SessionParticipant> findAllByInterviewSession(InterviewSession interviewSession);

    Page<SessionParticipant> findAllByMember(Member member, Pageable pageable);

    Page<SessionParticipant> findAllByMemberAndInterviewSession_Status(Member member, SessionStatus status, Pageable pageable);

    Optional<SessionParticipant> findByInterviewSessionAndMember(InterviewSession interviewSession, Member member);

    boolean existsByInterviewSessionAndMember(InterviewSession interviewSession, Member member);
}
