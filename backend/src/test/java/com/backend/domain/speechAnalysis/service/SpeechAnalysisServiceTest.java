package com.backend.domain.speechAnalysis.service;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
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
import com.backend.domain.speechAnalysis.dto.response.ScriptSegmentResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse;
import com.backend.domain.speechAnalysis.dto.response.SpeechAnalysisResponse;
import com.backend.domain.speechAnalysis.entity.ScriptSegment;
import com.backend.domain.speechAnalysis.entity.SegmentType;
import com.backend.domain.speechAnalysis.entity.SpeechAnalysis;
import com.backend.domain.speechAnalysis.repository.ScriptSegmentRepository;
import com.backend.domain.speechAnalysis.repository.SpeechAnalysisRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class SpeechAnalysisServiceTest {

    @InjectMocks
    private SpeechAnalysisService speechAnalysisService;

    @Mock private SpeechAnalysisRepository speechAnalysisRepository;
    @Mock private ScriptSegmentRepository scriptSegmentRepository;
    @Mock private InterviewAnswerRepository answerRepository;
    @Mock private InterviewQuestionRepository questionRepository;
    @Mock private InterviewSessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private MemberRepository memberRepository;

    private Member mentor;
    private InterviewSession session;
    private InterviewQuestion question;
    private InterviewAnswer answer;
    private SpeechAnalysis analysis;

    @BeforeEach
    void setUp() {
        mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("멘토").nickname("멘토닉").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        session = InterviewSession.builder()
                .mentor(mentor).jobCategory("백엔드").scheduledAt(LocalDateTime.now()).build();
        ReflectionTestUtils.setField(session, "id", 42L);

        question = InterviewQuestion.builder()
                .interviewSession(session).content("본인의 강점을 말해주세요.").orderIndex(0).build();
        ReflectionTestUtils.setField(question, "id", 101L);

        answer = InterviewAnswer.builder()
                .interviewQuestion(question).member(mentor)
                .audioUrl("s3://bucket/audio.webm")
                .answerStart(LocalDateTime.now()).answerEnd(LocalDateTime.now().plusSeconds(60)).build();
        ReflectionTestUtils.setField(answer, "id", 201L);
        answer.updateSttText("저는 당시 Spring Boot로...");
        answer.updateAiScore(3.8f);

        analysis = SpeechAnalysis.builder()
                .interviewAnswer(answer)
                .wpm(142.5f).deadAirCount(2).responseDelaySec(3.2f).avgWordsPerSentence(18.4f)
                .isStarS(true).isStarT(true).isStarA(false).isStarR(false).starRatio(0.5f)
                .build();
        ReflectionTestUtils.setField(analysis, "id", 301L);
    }

    // ===== getAnalysis =====

    @Test
    void getAnalysis_멘토_성공() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.of(analysis));

        SpeechAnalysisResponse response = speechAnalysisService.getAnalysis(1L, 42L, 101L, 201L);

        assertThat(response.answerId()).isEqualTo(201L);
        assertThat(response.sttText()).isEqualTo("저는 당시 Spring Boot로...");
        assertThat(response.wpm()).isEqualTo(142.5f);
        assertThat(response.deadAirCount()).isEqualTo(2);
        assertThat(response.responseDelaySec()).isEqualTo(3.2f);
        assertThat(response.isStarS()).isTrue();
        assertThat(response.isStarA()).isFalse();
        assertThat(response.starRatio()).isEqualTo(0.5f);
        assertThat(response.aiScore()).isEqualTo(3.8f);
    }

    @Test
    void getAnalysis_참여자_멘티_성공() {
        Member mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("멘티").nickname("멘티닉").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        SessionParticipant participant = SessionParticipant.builder()
                .interviewSession(session).member(mentee).answerStatus(AnswerStatus.WAITING).build();

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(2L)).willReturn(mentee);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.of(participant));
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.of(analysis));

        SpeechAnalysisResponse response = speechAnalysisService.getAnalysis(2L, 42L, 101L, 201L);

        assertThat(response.answerId()).isEqualTo(201L);
    }

    @Test
    void getAnalysis_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getAnalysis(1L, 999L, 101L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void getAnalysis_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getAnalysis(99L, 42L, 101L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void getAnalysis_질문없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getAnalysis(1L, 42L, 999L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.QUESTION_NOT_FOUND));
    }

    @Test
    void getAnalysis_답변없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getAnalysis(1L, 42L, 101L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ANSWER_NOT_FOUND));
    }

    @Test
    void getAnalysis_분석결과없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getAnalysis(1L, 42L, 101L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ANALYSIS_NOT_FOUND));
    }

    // ===== getSegments =====

    @Test
    void getSegments_성공() {
        ScriptSegment seg1 = ScriptSegment.builder()
                .speechAnalysis(analysis).content("저는 당시 팀의 리더로서...").segmentType(SegmentType.HIGHLIGHT).orderIndex(0).build();
        ScriptSegment seg2 = ScriptSegment.builder()
                .speechAnalysis(analysis).content("하지만 배포 일정이 급해졌고...").segmentType(SegmentType.NORMAL).orderIndex(1).build();
        ReflectionTestUtils.setField(seg1, "id", 401L);
        ReflectionTestUtils.setField(seg2, "id", 402L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.of(analysis));
        given(scriptSegmentRepository.findAllBySpeechAnalysisOrderByOrderIndex(analysis))
                .willReturn(List.of(seg1, seg2));

        List<ScriptSegmentResponse> response = speechAnalysisService.getSegments(1L, 42L, 101L, 201L);

        assertThat(response).hasSize(2);
        assertThat(response.get(0).id()).isEqualTo(401L);
        assertThat(response.get(0).answerId()).isEqualTo(201L);
        assertThat(response.get(0).segmentText()).isEqualTo("저는 당시 팀의 리더로서...");
        assertThat(response.get(0).segmentType()).isEqualTo("highlight");
        assertThat(response.get(0).orderIndex()).isEqualTo(0);
        assertThat(response.get(1).segmentType()).isEqualTo("normal");
    }

    @Test
    void getSegments_세그먼트없으면_빈리스트() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.of(analysis));
        given(scriptSegmentRepository.findAllBySpeechAnalysisOrderByOrderIndex(analysis)).willReturn(List.of());

        List<ScriptSegmentResponse> response = speechAnalysisService.getSegments(1L, 42L, 101L, 201L);

        assertThat(response).isEmpty();
    }

    @Test
    void getSegments_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getSegments(99L, 42L, 101L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void getSegments_분석결과없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findById(101L)).willReturn(Optional.of(question));
        given(answerRepository.findById(201L)).willReturn(Optional.of(answer));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getSegments(1L, 42L, 101L, 201L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ANALYSIS_NOT_FOUND));
    }

    // ===== getSummary =====

    @Test
    void getSummary_성공_best_worst_계산() {
        InterviewAnswer answer2 = InterviewAnswer.builder()
                .interviewQuestion(question).member(mentor)
                .audioUrl("s3://bucket/audio2.webm")
                .answerStart(LocalDateTime.now()).answerEnd(LocalDateTime.now().plusSeconds(90)).build();
        ReflectionTestUtils.setField(answer2, "id", 202L);
        answer2.updateAiScore(4.5f);

        SpeechAnalysis analysis2 = SpeechAnalysis.builder()
                .interviewAnswer(answer2)
                .wpm(130.0f).deadAirCount(1).responseDelaySec(2.0f).avgWordsPerSentence(20.0f)
                .isStarS(true).isStarT(true).isStarA(true).isStarR(false).starRatio(0.75f)
                .build();
        ReflectionTestUtils.setField(analysis2, "id", 302L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findAllByInterviewSessionOrderByOrderIndex(session)).willReturn(List.of(question));
        given(answerRepository.findAllByInterviewQuestion(question)).willReturn(List.of(answer, answer2));
        given(speechAnalysisRepository.findByInterviewAnswer(answer)).willReturn(Optional.of(analysis));
        given(speechAnalysisRepository.findByInterviewAnswer(answer2)).willReturn(Optional.of(analysis2));

        SessionAnalysisSummaryResponse response = speechAnalysisService.getSummary(1L, 42L);

        assertThat(response.sessionId()).isEqualTo(42L);
        assertThat(response.answers()).hasSize(2);
        assertThat(response.answers().get(0).answerId()).isEqualTo(201L);
        assertThat(response.answers().get(0).aiScore()).isEqualTo(3.8f);
        assertThat(response.answers().get(0).wpm()).isEqualTo(142.5f);
        assertThat(response.answers().get(0).starRatio()).isEqualTo(0.5f);
        assertThat(response.bestAnswerId()).isEqualTo(202L);
        assertThat(response.worstAnswerId()).isEqualTo(201L);
    }

    @Test
    void getSummary_분석된_답변없으면_best_worst_null() {
        InterviewAnswer unanswered = InterviewAnswer.builder()
                .interviewQuestion(question).member(mentor)
                .audioUrl("s3://bucket/audio.webm")
                .answerStart(LocalDateTime.now()).answerEnd(LocalDateTime.now().plusSeconds(60)).build();
        ReflectionTestUtils.setField(unanswered, "id", 203L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findAllByInterviewSessionOrderByOrderIndex(session)).willReturn(List.of(question));
        given(answerRepository.findAllByInterviewQuestion(question)).willReturn(List.of(unanswered));
        given(speechAnalysisRepository.findByInterviewAnswer(unanswered)).willReturn(Optional.empty());

        SessionAnalysisSummaryResponse response = speechAnalysisService.getSummary(1L, 42L);

        assertThat(response.sessionId()).isEqualTo(42L);
        assertThat(response.answers()).isEmpty();
        assertThat(response.bestAnswerId()).isNull();
        assertThat(response.worstAnswerId()).isNull();
    }

    @Test
    void getSummary_질문없으면_빈_응답() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(questionRepository.findAllByInterviewSessionOrderByOrderIndex(session)).willReturn(List.of());

        SessionAnalysisSummaryResponse response = speechAnalysisService.getSummary(1L, 42L);

        assertThat(response.answers()).isEmpty();
        assertThat(response.bestAnswerId()).isNull();
        assertThat(response.worstAnswerId()).isNull();
    }

    @Test
    void getSummary_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getSummary(1L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void getSummary_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> speechAnalysisService.getSummary(99L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }
}
