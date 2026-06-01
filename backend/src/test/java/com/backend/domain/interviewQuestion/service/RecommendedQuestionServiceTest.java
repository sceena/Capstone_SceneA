package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiQuestionGenerationClient;
import com.backend.domain.ai.dto.request.AiSessionQuestionGenerationRequest;
import com.backend.domain.ai.dto.response.AiSessionQuestionGenerationResponse;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestionBatch;
import com.backend.domain.interviewQuestion.repository.RecommendedQuestionBatchRepository;
import com.backend.domain.interviewQuestion.repository.RecommendedQuestionRepository;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RecommendedQuestionServiceTest {

    @InjectMocks
    private RecommendedQuestionService recommendedQuestionService;

    @Mock private InterviewSessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private ResumeRepository resumeRepository;
    @Mock private RecommendedQuestionBatchRepository batchRepository;
    @Mock private RecommendedQuestionRepository recommendedQuestionRepository;
    @Mock private AiQuestionGenerationClient aiQuestionGenerationClient;

    private Member mentor;
    private Member mentee;
    private InterviewSession session;

    @BeforeEach
    void setUp() {
        mentor = Member.builder()
                .email("mentor@test.com")
                .password("pw")
                .name("박멘토")
                .nickname("mentor")
                .role(Role.MENTOR)
                .build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        mentee = Member.builder()
                .email("mentee@test.com")
                .password("pw")
                .name("김멘티")
                .nickname("mentee")
                .role(Role.MENTEE)
                .build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        session = InterviewSession.builder()
                .mentor(mentor)
                .jobCategory("프론트엔드")
                .scheduledAt(LocalDateTime.now().plusDays(1))
                .build();
        ReflectionTestUtils.setField(session, "id", 10L);
    }

    @Test
    void 추천질문_후보에서_멘토를_제외하고_멘티가_1명이면_일대일_fallback_질문을_10개_생성한다() {
        SessionParticipant mentorParticipant = SessionParticipant.builder()
                .interviewSession(session)
                .member(mentor)
                .build();
        SessionParticipant menteeParticipant = SessionParticipant.builder()
                .interviewSession(session)
                .member(mentee)
                .answerStatus(AnswerStatus.WAITING)
                .build();
        Resume resume = Resume.builder()
                .interviewSession(session)
                .member(mentee)
                .content("프론트엔드 개발은 서비스의 가치를 사용자에게 전달하는 최전선입니다.")
                .build();
        RecommendedQuestionBatch batch = RecommendedQuestionBatch.builder()
                .interviewSession(session)
                .sessionType("ONE_TO_ONE")
                .build();

        given(sessionRepository.findById(10L)).willReturn(Optional.of(session));
        given(batchRepository.findByInterviewSession(session)).willReturn(Optional.empty());
        given(batchRepository.save(any(RecommendedQuestionBatch.class))).willReturn(batch);
        given(participantRepository.findAllByInterviewSession(session))
                .willReturn(List.of(mentorParticipant, menteeParticipant));
        given(resumeRepository.findByInterviewSessionAndMember(session, mentee)).willReturn(Optional.of(resume));
        given(aiQuestionGenerationClient.generateSessionQuestions(any()))
                .willThrow(new CustomException(ErrorCode.AI_SERVER_ERROR));

        AiSessionQuestionGenerationResponse response =
                recommendedQuestionService.generateRecommendedQuestions(1L, 10L);

        assertThat(response.sessionType()).isEqualTo("ONE_TO_ONE");
        assertThat(response.commonQuestions()).isEmpty();
        assertThat(response.personalQuestions()).hasSize(1);
        assertThat(response.personalQuestions().get(0).candidateId()).isEqualTo(2L);
        assertThat(response.personalQuestions().get(0).questions()).hasSize(10);

        ArgumentCaptor<AiSessionQuestionGenerationRequest> requestCaptor =
                ArgumentCaptor.forClass(AiSessionQuestionGenerationRequest.class);
        verify(aiQuestionGenerationClient).generateSessionQuestions(requestCaptor.capture());
        assertThat(requestCaptor.getValue().sessionType()).isEqualTo("ONE_TO_ONE");
        assertThat(requestCaptor.getValue().candidates()).hasSize(1);
        assertThat(requestCaptor.getValue().candidates().get(0).candidateId()).isEqualTo(2L);
    }
}
