package com.backend.domain.jobPosting.service;

import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.jobPosting.dto.request.JobPostingSaveRequest;
import com.backend.domain.jobPosting.dto.response.JobPostingSaveResponse;
import com.backend.domain.jobPosting.dto.response.JobSkillsResponse;
import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.entity.JobSkill;
import com.backend.domain.jobPosting.entity.SkillType;
import com.backend.domain.jobPosting.repository.JobPostingRepository;
import com.backend.domain.jobPosting.repository.JobSkillRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
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
class JobPostingServiceTest {

    @InjectMocks private JobPostingService jobPostingService;

    @Mock private JobPostingRepository jobPostingRepository;
    @Mock private JobSkillRepository jobSkillRepository;
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

    // ===== saveJobPosting =====

    @Test
    void 채용공고_저장_성공() {
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무: Spring Boot...", "https://...");

        JobPosting saved = JobPosting.builder()
                .interviewSession(session).company("네이버").jobCategory("백엔드 개발")
                .rawText("주요업무: Spring Boot...").url("https://...").build();
        ReflectionTestUtils.setField(saved, "id", 12L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.of(participant));
        given(jobPostingRepository.save(any())).willReturn(saved);

        JobPostingSaveResponse response = jobPostingService.saveJobPosting(2L, 42L, request);

        assertThat(response.id()).isEqualTo(12L);
        assertThat(response.company()).isEqualTo("네이버");
        assertThat(response.jobCategory()).isEqualTo("백엔드 개발");
        assertThat(response.rawText()).isEqualTo("주요업무: Spring Boot...");
        assertThat(response.sessionId()).isNull(); // BaseEntity ID not set by JPA in unit test
    }

    @Test
    void 채용공고_저장_세션없음_예외() {
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);

        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.saveJobPosting(2L, 999L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void 채용공고_저장_회원없음_예외() {
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.saveJobPosting(999L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }

    @Test
    void 채용공고_저장_비참여자_접근_403() {
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.findById(99L)).willReturn(Optional.of(outsider));
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.saveJobPosting(99L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    // ===== getJobSkills =====

    @Test
    void 채용공고_역량조회_성공() {
        JobPosting jobPosting = JobPosting.builder()
                .interviewSession(session).company("네이버").jobCategory("백엔드")
                .rawText("주요업무...").url(null).build();
        ReflectionTestUtils.setField(jobPosting, "id", 12L);

        JobSkill skill1 = JobSkill.builder().jobPosting(jobPosting).skill("Spring Boot").skillType(SkillType.REQUIRED).build();
        JobSkill skill2 = JobSkill.builder().jobPosting(jobPosting).skill("Docker").skillType(SkillType.PREFERRED).build();
        ReflectionTestUtils.setField(skill1, "id", 1L);
        ReflectionTestUtils.setField(skill2, "id", 2L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.of(jobPosting));
        given(jobSkillRepository.findAllByJobPosting(jobPosting)).willReturn(List.of(skill1, skill2));

        JobSkillsResponse response = jobPostingService.getJobSkills(1L, 42L);

        assertThat(response.jobPostingId()).isEqualTo(12L);
        assertThat(response.skills()).hasSize(2);
        assertThat(response.skills().get(0).skillName()).isEqualTo("Spring Boot");
        assertThat(response.skills().get(0).skillType()).isEqualTo("required");
        assertThat(response.skills().get(1).skillName()).isEqualTo("Docker");
        assertThat(response.skills().get(1).skillType()).isEqualTo("preferred");
    }

    @Test
    void 채용공고_역량조회_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.getJobSkills(1L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void 채용공고_역량조회_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.getJobSkills(99L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 채용공고_역량조회_채용공고없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.empty());

        assertThatThrownBy(() -> jobPostingService.getJobSkills(1L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.JOB_POSTING_NOT_FOUND));
    }
}
