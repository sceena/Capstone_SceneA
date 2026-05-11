package com.backend.domain.analysisReport.service;

import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.analysisReport.dto.response.FitGapResponse;
import com.backend.domain.analysisReport.dto.response.MentorFeedbackResponse;
import com.backend.domain.analysisReport.dto.response.ReportResponse;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.entity.ReportStatus;
import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.entity.JobSkill;
import com.backend.domain.jobPosting.entity.SkillType;
import com.backend.domain.jobPosting.repository.JobPostingRepository;
import com.backend.domain.jobPosting.repository.JobSkillRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
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
class ReportServiceTest {

    @InjectMocks
    private ReportService reportService;

    @Mock private AnalysisReportRepository reportRepository;
    @Mock private InterviewSessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private JobPostingRepository jobPostingRepository;
    @Mock private JobSkillRepository jobSkillRepository;
    @Mock private ResumeRepository resumeRepository;
    @Mock private ResumeSkillRepository resumeSkillRepository;

    private Member mentor;
    private InterviewSession session;
    private AnalysisReport report;

    @BeforeEach
    void setUp() {
        mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("멘토").nickname("멘토닉").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        session = InterviewSession.builder()
                .mentor(mentor).jobCategory("백엔드").scheduledAt(LocalDateTime.now()).build();

        report = AnalysisReport.builder()
                .interviewSession(session).aiSummary("AI 요약")
                .totalScore(3.9f).alignmentScore(0.72f)
                .bestMoment("3번 질문 STAR 구조 명확").worstMoment("1번 질문 dead air 3회").build();
        ReflectionTestUtils.setField(report, "id", 10L);
    }

    // ===== getReport =====

    @Test
    void getReport_멘토_성공() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));

        ReportResponse response = reportService.getReport(1L, 42L);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.reportStatus()).isEqualTo("first");
        assertThat(response.totalScore()).isEqualTo(3.9f);
        assertThat(response.alignmentScore()).isEqualTo(0.72f);
        assertThat(response.bestMoment()).isEqualTo("3번 질문 STAR 구조 명확");
        assertThat(response.mentorFeedback()).isNull();
    }

    @Test
    void getReport_참여자_멘티_성공() {
        Member mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("멘티").nickname("멘티닉").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        SessionParticipant participant = SessionParticipant.builder()
                .interviewSession(session).member(mentee).answerStatus(AnswerStatus.WAITING).build();

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(2L)).willReturn(mentee);
        given(participantRepository.findByInterviewSessionAndMember(any(), any()))
                .willReturn(Optional.of(participant));
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));

        ReportResponse response = reportService.getReport(2L, 42L);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.reportStatus()).isEqualTo("first");
    }

    @Test
    void getReport_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getReport(1L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void getReport_권한없음_예외() {
        Member outsider = Member.builder()
                .email("out@test.com").password("enc").name("외부인").nickname("외부").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(outsider, "id", 99L);

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(99L)).willReturn(outsider);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getReport(99L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void getReport_리포트없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getReport(1L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }

    // ===== getFitGap =====

    @Test
    void getFitGap_성공_matched_unmatched_정확히_계산() {
        JobPosting jobPosting = JobPosting.builder().interviewSession(session).company("네이버").jobCategory("백엔드").rawText("채용공고").build();
        JobSkill springSkill = JobSkill.builder().jobPosting(jobPosting).skill("Spring Boot").skillType(SkillType.REQUIRED).build();
        JobSkill k8sSkill = JobSkill.builder().jobPosting(jobPosting).skill("Kubernetes").skillType(SkillType.PREFERRED).build();

        Resume resume = Resume.builder().member(mentor).interviewSession(session).content("자소서").build();
        ResumeSkill resumeSpring = ResumeSkill.builder().resume(resume).skill("Spring Boot").build();
        ResumeSkill resumeJpa = ResumeSkill.builder().resume(resume).skill("JPA").build();

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.of(jobPosting));
        given(jobSkillRepository.findAllByJobPosting(jobPosting)).willReturn(List.of(springSkill, k8sSkill));
        given(resumeRepository.findAllByInterviewSession(session)).willReturn(List.of(resume));
        given(resumeSkillRepository.findAllByResume(resume)).willReturn(List.of(resumeSpring, resumeJpa));

        FitGapResponse response = reportService.getFitGap(1L, 42L);

        assertThat(response.reportId()).isEqualTo(10L);
        assertThat(response.jobSkills()).hasSize(2);
        assertThat(response.jobSkills().get(0).skillName()).isEqualTo("Spring Boot");
        assertThat(response.jobSkills().get(0).skillType()).isEqualTo("required");
        assertThat(response.resumeSkills()).hasSize(2);
        assertThat(response.matched()).containsExactly("Spring Boot");
        assertThat(response.unmatched()).containsExactly("Kubernetes");
    }

    @Test
    void getFitGap_대소문자_무시하고_matched_계산() {
        JobPosting jobPosting = JobPosting.builder().interviewSession(session).company("네이버").jobCategory("백엔드").rawText("채용공고").build();
        JobSkill skill = JobSkill.builder().jobPosting(jobPosting).skill("Spring Boot").skillType(SkillType.REQUIRED).build();

        Resume resume = Resume.builder().member(mentor).interviewSession(session).content("자소서").build();
        ResumeSkill resumeSkill = ResumeSkill.builder().resume(resume).skill("spring boot").build();

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.of(jobPosting));
        given(jobSkillRepository.findAllByJobPosting(jobPosting)).willReturn(List.of(skill));
        given(resumeRepository.findAllByInterviewSession(session)).willReturn(List.of(resume));
        given(resumeSkillRepository.findAllByResume(resume)).willReturn(List.of(resumeSkill));

        FitGapResponse response = reportService.getFitGap(1L, 42L);

        assertThat(response.matched()).containsExactly("Spring Boot");
        assertThat(response.unmatched()).isEmpty();
    }

    @Test
    void getFitGap_세션없음_예외() {
        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getFitGap(1L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void getFitGap_리포트없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getFitGap(1L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }

    @Test
    void getFitGap_채용공고없음_예외() {
        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getFitGap(1L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.JOB_POSTING_NOT_FOUND));
    }

    @Test
    void getFitGap_자소서없음_예외() {
        JobPosting jobPosting = JobPosting.builder().interviewSession(session).company("네이버").jobCategory("백엔드").rawText("채용공고").build();

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(memberRepository.getReferenceById(1L)).willReturn(mentor);
        given(participantRepository.findByInterviewSessionAndMember(any(), any())).willReturn(Optional.empty());
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));
        given(jobPostingRepository.findByInterviewSession(session)).willReturn(Optional.of(jobPosting));
        given(jobSkillRepository.findAllByJobPosting(jobPosting)).willReturn(List.of());
        given(resumeRepository.findAllByInterviewSession(session)).willReturn(List.of());

        assertThatThrownBy(() -> reportService.getFitGap(1L, 42L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.RESUME_NOT_FOUND));
    }

    // ===== addMentorFeedback =====

    @Test
    void addMentorFeedback_성공_상태가_FINAL로_변경() {
        MentorFeedbackRequest request = new MentorFeedbackRequest("전반적으로 답변 구조가 잘 잡혀 있으나 구체적인 수치 제시가 부족합니다.");

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.of(report));

        MentorFeedbackResponse response = reportService.addMentorFeedback(1L, 42L, request);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.reportStatus()).isEqualTo("final");
        assertThat(response.mentorFeedback()).isEqualTo("전반적으로 답변 구조가 잘 잡혀 있으나 구체적인 수치 제시가 부족합니다.");
        assertThat(report.getReportStatus()).isEqualTo(ReportStatus.FINAL);
    }

    @Test
    void addMentorFeedback_세션없음_예외() {
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백");

        given(sessionRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.addMentorFeedback(1L, 999L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    @Test
    void addMentorFeedback_멘토아닌_멤버_접근_예외() {
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백");

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));

        assertThatThrownBy(() -> reportService.addMentorFeedback(99L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void addMentorFeedback_리포트없음_예외() {
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백");

        given(sessionRepository.findById(42L)).willReturn(Optional.of(session));
        given(reportRepository.findByInterviewSession(session)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.addMentorFeedback(1L, 42L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }
}
