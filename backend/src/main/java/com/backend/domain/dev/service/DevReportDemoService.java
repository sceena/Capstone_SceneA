package com.backend.domain.dev.service;

import com.backend.domain.dev.dto.DevReportDemoResponse;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.entity.AudioQualityStatus;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.repository.JobPostingRepository;
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

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DevReportDemoService {

    private static final String MENTOR_EMAIL = "dev-mentor@scenea.local";
    private static final String MENTEE_EMAIL = "dev-mentee@scenea.local";

    private final MemberRepository memberRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final InterviewQuestionRepository questionRepository;
    private final InterviewAnswerRepository answerRepository;
    private final ResumeRepository resumeRepository;
    private final JobPostingRepository jobPostingRepository;
    private final JwtProvider jwtProvider;

    @Transactional
    public DevReportDemoResponse createReportDemo() {
        Member mentor = getOrCreateMember(MENTOR_EMAIL, "AI 데모 멘토", "demoMentor", Role.MENTOR);
        Member mentee = getOrCreateMember(MENTEE_EMAIL, "AI 데모 멘티", "demoMentee", Role.MENTEE);

        InterviewSession session = sessionRepository.save(InterviewSession.builder()
                .mentor(mentor)
                .jobCategory("backend")
                .scheduledAt(LocalDateTime.now().plusDays(1))
                .build());

        participantRepository.save(SessionParticipant.builder()
                .interviewSession(session)
                .member(mentee)
                .answerStatus(AnswerStatus.ANSWERING_DONE)
                .build());

        InterviewQuestion redisQuestion = questionRepository.save(InterviewQuestion.builder()
                .interviewSession(session)
                .content("Redis 캐시를 사용하는 이유를 설명해주세요.")
                .orderIndex(0)
                .build());

        InterviewQuestion transactionQuestion = questionRepository.save(InterviewQuestion.builder()
                .interviewSession(session)
                .content("트랜잭션 전파 옵션을 설명해주세요.")
                .orderIndex(1)
                .build());

        saveAnswer(redisQuestion, mentee,
                "DB 부하를 줄이기 위해 Redis 캐시를 적용했습니다. 상품 조회 API에서 반복 조회가 많아 TTL을 설정했고, 적용 후 응답 시간이 30% 개선되었습니다.",
                "answers/demo/session-" + session.getId() + "/redis.wav",
                36);

        saveAnswer(transactionQuestion, mentee,
                "REQUIRED와 REQUIRES_NEW가 있습니다. REQUIRED는 기존 트랜잭션에 참여하고 REQUIRES_NEW는 새로 만듭니다.",
                "answers/demo/session-" + session.getId() + "/transaction.wav",
                25);

        resumeRepository.save(Resume.builder()
                .member(mentee)
                .interviewSession(session)
                .content("Spring Boot 쇼핑몰 API 프로젝트에서 Redis 캐시를 적용하고 MySQL 인덱스를 튜닝한 경험이 있습니다.")
                .build());

        jobPostingRepository.save(JobPosting.builder()
                .interviewSession(session)
                .company("SceneA Labs")
                .jobCategory("backend")
                .rawText("Spring Boot 기반 API 개발, Redis 캐시, MySQL 성능 개선, 장애 대응 경험을 우대합니다.")
                .url("https://example.com/jobs/backend")
                .build());

        String mentorToken = jwtProvider.generateAccessToken(mentor.getId(), mentor.getRole().name());
        String menteeToken = jwtProvider.generateAccessToken(mentee.getId(), mentee.getRole().name());

        return new DevReportDemoResponse(
                session.getId(),
                mentor.getId(),
                mentee.getId(),
                mentorToken,
                menteeToken,
                "/api/sessions/" + session.getId() + "/report/generate",
                "/api/sessions/" + session.getId() + "/report"
        );
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

    private void saveAnswer(InterviewQuestion question, Member mentee, String sttText, String audioUrl, int durationSec) {
        LocalDateTime start = LocalDateTime.now();
        LocalDateTime end = start.plusSeconds(durationSec);

        InterviewAnswer answer = answerRepository.save(InterviewAnswer.builder()
                .interviewQuestion(question)
                .member(mentee)
                .audioUrl(audioUrl)
                .answerStart(start)
                .answerEnd(end)
                .build());

        answer.completeStt(
                sttText,
                "dev-seed",
                (float) durationSec,
                AudioQualityStatus.OK,
                null
        );
    }
}
