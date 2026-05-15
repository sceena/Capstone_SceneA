package com.backend.domain.resume.repository;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.member.entity.Member;
import com.backend.domain.resume.entity.Resume;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ResumeRepository extends JpaRepository<Resume, Long> {

    Optional<Resume> findByInterviewSessionAndMember(InterviewSession interviewSession, Member member);

    List<Resume> findAllByInterviewSession(InterviewSession interviewSession);
}
