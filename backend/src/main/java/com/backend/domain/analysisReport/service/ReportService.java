package com.backend.domain.analysisReport.service;

import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.analysisReport.dto.response.FitGapResponse;
import com.backend.domain.analysisReport.dto.response.JobSkillInfo;
import com.backend.domain.analysisReport.dto.response.MentorFeedbackResponse;
import com.backend.domain.analysisReport.dto.response.ReportResponse;
import com.backend.domain.analysisReport.dto.response.ResumeSkillInfo;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final AnalysisReportRepository reportRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;
    private final JobPostingRepository jobPostingRepository;
    private final JobSkillRepository jobSkillRepository;
    private final ResumeRepository resumeRepository;
    private final ResumeSkillRepository resumeSkillRepository;

    public ReportResponse getReport(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateAccess(memberId, session);

        AnalysisReport report = reportRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.REPORT_NOT_FOUND));

        return ReportResponse.from(report);
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
}
