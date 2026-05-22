package com.backend.domain.analysisReport.service;

import com.backend.domain.ai.client.AiReportClient;
import com.backend.domain.ai.dto.request.AiAnswerMetricsRequest;
import com.backend.domain.ai.dto.request.AiCandidateContext;
import com.backend.domain.ai.dto.request.AiCompanyContext;
import com.backend.domain.ai.dto.request.AiInterviewAnswerRequest;
import com.backend.domain.ai.dto.request.AiReportRequest;
import com.backend.domain.ai.dto.response.AiReportResponse;
import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.analysisReport.dto.response.FitGapResponse;
import com.backend.domain.analysisReport.dto.response.JobSkillInfo;
import com.backend.domain.analysisReport.dto.response.MentorFeedbackResponse;
import com.backend.domain.analysisReport.dto.response.ReportResponse;
import com.backend.domain.analysisReport.dto.response.ResumeSkillInfo;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.entity.JobSkill;
import com.backend.domain.jobPosting.repository.JobPostingRepository;
import com.backend.domain.jobPosting.repository.JobSkillRepository;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.entity.ResumeSkill;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.domain.resume.repository.ResumeSkillRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private static final int CONTEXT_MAX_LENGTH = 1000;

    private final AnalysisReportRepository reportRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;
    private final InterviewQuestionRepository questionRepository;
    private final InterviewAnswerRepository answerRepository;
    private final JobPostingRepository jobPostingRepository;
    private final JobSkillRepository jobSkillRepository;
    private final ResumeRepository resumeRepository;
    private final ResumeSkillRepository resumeSkillRepository;
    private final AiReportClient aiReportClient;
    private final ObjectMapper objectMapper;

    public ReportResponse getReport(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateAccess(memberId, session);

        AnalysisReport report = reportRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.REPORT_NOT_FOUND));

        return ReportResponse.from(report, parseAiReport(report.getRawAiResponseJson()));
    }

    @Transactional
    public ReportResponse generateReport(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateAccess(memberId, session);

        AiReportRequest request = buildAiReportRequest(session);
        AiReportResponse aiResponse = aiReportClient.generateReport(request);
        String rawAiResponseJson = toJson(aiResponse);

        AnalysisReport report = reportRepository.findByInterviewSession(session)
                .orElseGet(() -> AnalysisReport.builder()
                        .interviewSession(session)
                        .build());

        report.updateAiReport(
                buildAiSummary(aiResponse),
                aiResponse.overallScore(),
                null,
                extractBestMoment(aiResponse),
                extractWorstMoment(aiResponse),
                rawAiResponseJson
        );

        return ReportResponse.from(reportRepository.save(report), aiResponse);
    }

    public FitGapResponse getFitGap(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateAccess(memberId, session);

        AnalysisReport report = reportRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.REPORT_NOT_FOUND));

        JobPosting jobPosting = jobPostingRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.JOB_POSTING_NOT_FOUND));

        List<JobSkill> jobSkills = jobSkillRepository.findAllByJobPosting(jobPosting);

        List<Resume> resumes = resumeRepository.findAllByInterviewSession(session);
        if (resumes.isEmpty()) {
            throw new CustomException(ErrorCode.RESUME_NOT_FOUND);
        }

        List<ResumeSkill> resumeSkills = resumes.stream()
                .flatMap(resume -> resumeSkillRepository.findAllByResume(resume).stream())
                .toList();

        // AI가 채운 skill 목록을 기반으로 집합 연산만 수행
        Set<String> resumeSkillNames = resumeSkills.stream()
                .map(rs -> rs.getSkill().toLowerCase())
                .collect(Collectors.toSet());

        List<String> matched = jobSkills.stream()
                .map(JobSkill::getSkill)
                .filter(skill -> resumeSkillNames.contains(skill.toLowerCase()))
                .distinct()
                .toList();

        List<String> unmatched = jobSkills.stream()
                .map(JobSkill::getSkill)
                .filter(skill -> !resumeSkillNames.contains(skill.toLowerCase()))
                .distinct()
                .toList();

        List<JobSkillInfo> jobSkillInfos = jobSkills.stream()
                .map(JobSkillInfo::from)
                .toList();

        List<ResumeSkillInfo> resumeSkillInfos = resumeSkills.stream()
                .map(ResumeSkillInfo::from)
                .distinct()
                .toList();

        return new FitGapResponse(report.getId(), jobSkillInfos, resumeSkillInfos, matched, unmatched);
    }

    @Transactional
    public MentorFeedbackResponse addMentorFeedback(Long memberId, Long sessionId, MentorFeedbackRequest request) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        if (!session.getMentor().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        AnalysisReport report = reportRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.REPORT_NOT_FOUND));

        report.completeFinal(request.mentorFeedback());

        return MentorFeedbackResponse.from(report);
    }

    private void validateAccess(Long memberId, InterviewSession session) {
        boolean isMentor = session.getMentor().getId().equals(memberId);
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session, memberRepository.getReferenceById(memberId))
                .isPresent();

        if (!isMentor && !isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }

    private AiReportRequest buildAiReportRequest(InterviewSession session) {
        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session);
        SessionParticipant candidate = participants.stream()
                .filter(participant -> !participant.getMember().getId().equals(session.getMentor().getId()))
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        List<Resume> resumes = resumeRepository.findAllByInterviewSession(session);
        Optional<JobPosting> jobPosting = jobPostingRepository.findByInterviewSession(session);

        List<AiInterviewAnswerRequest> answers = questionRepository
                .findAllByInterviewSessionOrderByOrderIndex(session)
                .stream()
                .flatMap(question -> answerRepository.findAllByInterviewQuestion(question).stream()
                        .map(answer -> toAiAnswerRequest(question, answer)))
                .toList();

        if (answers.isEmpty()) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }

        AiCandidateContext candidateContext = new AiCandidateContext(
                candidate.getMember().getId(),
                candidate.getMember().getName(),
                "junior",
                session.getJobCategory(),
                resumes.stream()
                        .map(resume -> summarize(resume.getContent()))
                        .toList()
        );

        AiCompanyContext companyContext = new AiCompanyContext(
                jobPosting.map(JobPosting::getCompany).orElse(null),
                jobPosting.map(JobPosting::getJobCategory).orElse(session.getJobCategory()),
                jobPosting.map(posting -> summarize(posting.getRawText())).orElse(null),
                jobPosting.map(JobPosting::getUrl).orElse(null)
        );

        return new AiReportRequest(session.getId(), candidateContext, companyContext, answers);
    }

    private AiInterviewAnswerRequest toAiAnswerRequest(InterviewQuestion question, InterviewAnswer answer) {
        return new AiInterviewAnswerRequest(
                question.getId(),
                question.getContent(),
                answer.getId(),
                answer.getSttText(),
                answer.getAudioUrl(),
                answer.getAnswerStart().toString(),
                answer.getAnswerEnd().toString(),
                buildMetrics(answer)
        );
    }

    private AiAnswerMetricsRequest buildMetrics(InterviewAnswer answer) {
        Long durationSec = Duration.between(answer.getAnswerStart(), answer.getAnswerEnd()).getSeconds();
        String answerText = answer.getSttText();

        return new AiAnswerMetricsRequest(
                durationSec,
                estimateSpeakingSpeed(answerText, durationSec),
                "미측정",
                estimateSentenceClarity(answerText),
                "AI 판단 필요"
        );
    }

    private String estimateSpeakingSpeed(String text, Long durationSec) {
        if (text == null || text.isBlank() || durationSec == null || durationSec <= 0) {
            return "미측정";
        }

        double cpm = text.length() / (durationSec / 60.0);
        if (cpm < 250) {
            return "느림";
        }
        if (cpm > 450) {
            return "빠름";
        }
        return "적정";
    }

    private String estimateSentenceClarity(String text) {
        if (text == null || text.isBlank()) {
            return "미측정";
        }

        String[] sentences = text.split("[.!?。！？]|다\\.|요\\.");
        int sentenceCount = Math.max(1, sentences.length);
        int avgLength = text.length() / sentenceCount;

        if (avgLength > 80) {
            return "장황함";
        }
        if (avgLength < 20) {
            return "짧음";
        }
        return "보통";
    }

    private String summarize(String text) {
        if (text == null) {
            return null;
        }
        if (text.length() <= CONTEXT_MAX_LENGTH) {
            return text;
        }
        return text.substring(0, CONTEXT_MAX_LENGTH);
    }

    private String toJson(AiReportResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private AiReportResponse parseAiReport(String rawAiResponseJson) {
        if (rawAiResponseJson == null || rawAiResponseJson.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(rawAiResponseJson, AiReportResponse.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String buildAiSummary(AiReportResponse response) {
        if (response.fitGap() == null) {
            return "AI 리포트가 생성되었습니다.";
        }

        int matchedCount = response.fitGap().matchedRequirements() == null
                ? 0
                : response.fitGap().matchedRequirements().size();
        int missingCount = response.fitGap().missingRequirements() == null
                ? 0
                : response.fitGap().missingRequirements().size();

        return "충족 요구사항 " + matchedCount
                + "개, 부족 요구사항 " + missingCount
                + "개가 분석되었습니다.";
    }

    private String extractBestMoment(AiReportResponse response) {
        if (response.topSummary() == null || response.topSummary().bestQuestion() == null) {
            return null;
        }
        return response.topSummary().bestQuestion().reason();
    }

    private String extractWorstMoment(AiReportResponse response) {
        if (response.topSummary() == null || response.topSummary().worstQuestion() == null) {
            return null;
        }
        return response.topSummary().worstQuestion().reason();
    }
}
