package com.backend.domain.jobPosting.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.jobPosting.dto.request.JobPostingSaveRequest;
import com.backend.domain.jobPosting.dto.response.JobPostingSaveResponse;
import com.backend.domain.jobPosting.dto.response.JobSkillDetailInfo;
import com.backend.domain.jobPosting.dto.response.JobSkillsResponse;
import com.backend.domain.jobPosting.entity.JobPosting;
import com.backend.domain.jobPosting.repository.JobPostingRepository;
import com.backend.domain.jobPosting.repository.JobSkillRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JobPostingService {

    private final JobPostingRepository jobPostingRepository;
    private final JobSkillRepository jobSkillRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public JobPostingSaveResponse saveJobPosting(Long memberId, Long sessionId, JobPostingSaveRequest request) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        validateMenteeAccess(session, member);

        JobPosting jobPosting = JobPosting.builder()
                .interviewSession(session)
                .company(request.company())
                .jobCategory(request.jobCategory())
                .rawText(request.rawText())
                .url(request.url())
                .build();

        return JobPostingSaveResponse.from(jobPostingRepository.save(jobPosting));
    }

    public JobSkillsResponse getJobSkills(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateSessionAccess(memberId, session);

        JobPosting jobPosting = jobPostingRepository.findByInterviewSession(session)
                .orElseThrow(() -> new CustomException(ErrorCode.JOB_POSTING_NOT_FOUND));

        List<JobSkillDetailInfo> skills = jobSkillRepository.findAllByJobPosting(jobPosting)
                .stream()
                .map(JobSkillDetailInfo::from)
                .toList();

        return new JobSkillsResponse(jobPosting.getId(), skills);
    }

    private void validateMenteeAccess(InterviewSession session, Member member) {
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session, member)
                .isPresent();

        if (!isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void validateSessionAccess(Long memberId, InterviewSession session) {
        boolean isMentor = session.getMentor().getId().equals(memberId);
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session, memberRepository.getReferenceById(memberId))
                .isPresent();

        if (!isMentor && !isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
