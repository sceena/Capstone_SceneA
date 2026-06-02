package com.backend.domain.resume.service;

import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.resume.dto.request.ResumeSaveRequest;
import com.backend.domain.resume.dto.response.ResumeSaveResponse;
import com.backend.domain.resume.dto.response.ResumeSkillsResponse;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.entity.ResumeSkill;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.domain.resume.repository.ResumeSkillRepository;
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
class ResumeServiceTest {

    @InjectMocks private ResumeService resumeService;

    @Mock private ResumeRepository resumeRepository;
    @Mock private ResumeSkillRepository resumeSkillRepository;
    @Mock private InterviewSessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private MemberRepository memberRepository;

    private Member mentor;
    private Member mentee;
    private InterviewSession session;
    private SessionParticipant participant;

    @BeforeEach
    void setUp() {
        mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("멘토").nickname("멘토닉").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("멘티").nickname("멘티닉").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        session = InterviewSession.builder()
                .mentor(mentor).jobCategory("백엔드").scheduledAt(LocalDateTime.now()).build();

        participant = SessionParticipant.builder()
                .interviewSession(session).member(mentee).answerStatus(AnswerStatus.WAITING).build();
    }

    // ===== saveResume =====

    @Test
    void 자소서_저장_성공() {
        ResumeSaveRequest request = new ResumeSaveRequest("저는 3년간 백엔드 개발자로...");

        Resume saved = Resume.builder().interviewSession(session).member(mentee).content("저는 3년간 백엔드 개발자로...").build();
        ReflectionTestUtils.setField(saved, "id", 7L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.of(participant));
        given(resumeRepository.save(any())).willReturn(saved);

        ResumeSaveResponse response = resumeService.saveResume(2L, 42L, request);

        assertThat(response.id()).isEqualTo(7L);
        assertThat(response.content()).isEqualTo("저는 3년간 백엔드 개발자로...");
    }

    @Test
    void 자소서_저장_세션없음_예외() {
        ResumeSaveRequest request = new ResumeSaveRequest("내용");

        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.saveResume(2L, 999L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void 자소서_저장_회원없음_예외() {
        ResumeSaveRequest request = new ResumeSaveRequest("내용");

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.saveResume(999L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }

    @Test
    void 자소서_저장_비참여자_접근_403() {
        ResumeSaveRequest request = new ResumeSaveRequest("내용");
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(99L)).willReturn(Optional.of(outsider));
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.saveResume(99L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 멘티별_자소서_조회_성공() {
        Resume resume = Resume.builder().interviewSession(session).member(mentee).content("멘티별 자소서").build();
        ReflectionTestUtils.setField(resume, "id", 8L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(participantRepository.findByInterviewSessionAndMember(session, mentee)).willReturn(Optional.of(participant));
        given(resumeRepository.findByInterviewSessionAndMember(session, mentee)).willReturn(Optional.of(resume));

        ResumeSaveResponse response = resumeService.getResumeByMentee(1L, 42L, 2L);

        assertThat(response.id()).isEqualTo(8L);
        assertThat(response.content()).isEqualTo("멘티별 자소서");
    }

    @Test
    void 멘티별_자소서_조회_비참여자_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(99L)).willReturn(Optional.of(outsider));
        given(participantRepository.findByInterviewSessionAndMember(session, outsider)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.getResumeByMentee(1L, 42L, 99L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    // ===== getResumeSkills =====

    @Test
    void 자소서_역량조회_성공() {
        Resume resume = Resume.builder().interviewSession(session).member(mentee).content("내용").build();
        ReflectionTestUtils.setField(resume, "id", 7L);

        ResumeSkill skill1 = ResumeSkill.builder().resume(resume).skill("Spring Boot").build();
        ResumeSkill skill2 = ResumeSkill.builder().resume(resume).skill("JPA").build();
        ReflectionTestUtils.setField(skill1, "id", 1L);
        ReflectionTestUtils.setField(skill2, "id", 2L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(2L)).willReturn(mentee);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.of(participant));
        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(resumeRepository.findByInterviewSessionAndMember(session, mentee)).willReturn(Optional.of(resume));
        given(resumeSkillRepository.findAllByResume(resume)).willReturn(List.of(skill1, skill2));

        ResumeSkillsResponse response = resumeService.getResumeSkills(2L, 42L);

        assertThat(response.resumeId()).isEqualTo(7L);
        assertThat(response.skills()).hasSize(2);
        assertThat(response.skills().get(0).skillName()).isEqualTo("Spring Boot");
        assertThat(response.skills().get(1).skillName()).isEqualTo("JPA");
    }

    @Test
    void 자소서_역량조회_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.getResumeSkills(2L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void 자소서_역량조회_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.getResumeSkills(99L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 자소서_역량조회_자소서없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(2L)).willReturn(mentee);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.of(participant));
        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(resumeRepository.findByInterviewSessionAndMember(session, mentee)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.getResumeSkills(2L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.RESUME_NOT_FOUND));
    }
}
