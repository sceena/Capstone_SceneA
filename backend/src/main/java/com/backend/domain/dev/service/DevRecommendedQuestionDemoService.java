package com.backend.domain.dev.service;

import com.backend.domain.dev.dto.DevRecommendedQuestionDemoResponse;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.jwt.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DevRecommendedQuestionDemoService {

    private static final String MENTOR_EMAIL = "dev-question-mentor@scenea.local";

    private final MemberRepository memberRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ResumeRepository resumeRepository;
    private final JwtProvider jwtProvider;

    @Transactional
    public DevRecommendedQuestionDemoResponse createRecommendedQuestionDemo() {
        Member mentor = getOrCreateMember(MENTOR_EMAIL, "Question Demo Mentor", "questionDemoMentor", Role.MENTOR);

        InterviewSession session = sessionRepository.save(InterviewSession.builder()
                .mentor(mentor)
                .jobCategory("software engineering")
                .scheduledAt(LocalDateTime.now().plusDays(1))
                .build());

        List<Long> participantIds = new ArrayList<>();
        createParticipantWithResume(
                session,
                "dev-question-mentee-1@scenea.local",
                "Question Demo Mentee 1",
                "questionDemoMentee1",
                """
                        Spring Boot community project. Designed REST APIs for post search and category management.
                        Used JPA and improved an N+1 query issue with fetch join.
                        Added Redis cache for popular posts with TTL.
                        Built local Spring Boot and MySQL environment with Docker Compose.
                        """,
                participantIds
        );
        createParticipantWithResume(
                session,
                "dev-question-mentee-2@scenea.local",
                "Question Demo Mentee 2",
                "questionDemoMentee2",
                """
                        React frontend project. Used Zustand for UI state and React Query for server state.
                        Managed query keys for data caching and tuned staleTime.
                        Built common UI components with Storybook.
                        Used Vercel rewrites to route API requests during deployment.
                        """,
                participantIds
        );
        createParticipantWithResume(
                session,
                "dev-question-mentee-3@scenea.local",
                "Question Demo Mentee 3",
                "questionDemoMentee3",
                """
                        NestJS realtime chat project. Implemented Socket.io based chat.
                        Used Redis Pub/Sub to synchronize messages across multiple server instances.
                        Worked with PostgreSQL query tuning and index management.
                        Added Jest unit tests for service logic.
                        """,
                participantIds
        );
        createParticipantWithResume(
                session,
                "dev-question-mentee-4@scenea.local",
                "Question Demo Mentee 4",
                "questionDemoMentee4",
                """
                        FastAPI data processing project. Converted CSV data to JSON and stored it in PostgreSQL.
                        Used Celery and RabbitMQ for asynchronous processing.
                        Connected PostgreSQL with SQLAlchemy and managed migrations with Alembic.
                        Used Docker for local development environment setup.
                        """,
                participantIds
        );

        return new DevRecommendedQuestionDemoResponse(
                session.getId(),
                mentor.getId(),
                participantIds,
                jwtProvider.generateAccessToken(mentor.getId(), mentor.getRole().name()),
                "/api/sessions/" + session.getId() + "/questions/recommendations",
                "/api/sessions/" + session.getId() + "/questions"
        );
    }

    private void createParticipantWithResume(
            InterviewSession session,
            String email,
            String name,
            String nickname,
            String resumeContent,
            List<Long> participantIds) {
        Member mentee = getOrCreateMember(email, name, nickname, Role.MENTEE);
        participantIds.add(mentee.getId());

        participantRepository.save(SessionParticipant.builder()
                .interviewSession(session)
                .member(mentee)
                .answerStatus(AnswerStatus.WAITING)
                .build());

        resumeRepository.save(Resume.builder()
                .member(mentee)
                .interviewSession(session)
                .content(resumeContent)
                .build());
    }

    private Member getOrCreateMember(String email, String name, String nickname, Role role) {
        return memberRepository.findByEmail(email)
                .orElseGet(() -> memberRepository.save(Member.builder()
                        .email(email)
                        .password("{noop}dev-password")
                        .name(name)
                        .nickname(nickname)
                        .role(role)
                        .build()));
    }
}
