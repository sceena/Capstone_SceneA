package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiSttJobClient;
import com.backend.domain.interviewQuestion.dto.request.QuestionCreateRequest;
import com.backend.domain.interviewQuestion.dto.response.QuestionCreateResponse;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.S3Client;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class QuestionServiceTest {

    @InjectMocks
    private QuestionService questionService;

    @Mock private InterviewQuestionRepository questionRepository;
    @Mock private InterviewSessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private S3Client s3Client;
    @Mock private AiSttJobClient aiSttJobClient;

    @Test
    void 질문_저장시_질문유형과_지원자ID를_함께_저장한다() {
        Member mentor = Member.builder()
                .name("멘토")
                .nickname("mentor")
                .role(Role.MENTOR)
                .build();
        ReflectionTestUtils.setField(mentor, "id", 1L);
        Member mentee = Member.builder()
                .name("멘티")
                .nickname("mentee")
                .role(Role.MENTEE)
                .build();
        ReflectionTestUtils.setField(mentee, "id", 2L);
        InterviewSession session = InterviewSession.builder()
                .mentor(mentor)
                .jobCategory("백엔드")
                .scheduledAt(LocalDateTime.now())
                .build();
        QuestionCreateRequest request = new QuestionCreateRequest(List.of(
                new QuestionCreateRequest.QuestionItem("공통 질문", "COMMON", null),
                new QuestionCreateRequest.QuestionItem("개인 질문", "PERSONAL", 2L)
        ));

        given(sessionRepository.findById(10L)).willReturn(Optional.of(session));
        given(participantRepository.findAllByInterviewSession(session)).willReturn(List.of(
                SessionParticipant.builder()
                        .interviewSession(session)
                        .member(mentee)
                        .answerStatus(AnswerStatus.WAITING)
                        .build()
        ));
        given(questionRepository.findAllByInterviewSessionOrderByOrderIndex(session)).willReturn(List.of());
        given(questionRepository.saveAll(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        List<QuestionCreateResponse> response = questionService.createQuestions(mentor.getId(), 10L, request);

        ArgumentCaptor<List<InterviewQuestion>> captor = ArgumentCaptor.forClass(List.class);
        verify(questionRepository).saveAll(captor.capture());

        List<InterviewQuestion> saved = captor.getValue();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getQuestionType()).isEqualTo("COMMON");
        assertThat(saved.get(0).getCandidateId()).isNull();
        assertThat(saved.get(1).getQuestionType()).isEqualTo("PERSONAL");
        assertThat(saved.get(1).getCandidateId()).isEqualTo(2L);
        assertThat(response.get(1).questionType()).isEqualTo("PERSONAL");
        assertThat(response.get(1).candidateId()).isEqualTo(2L);
    }
}
