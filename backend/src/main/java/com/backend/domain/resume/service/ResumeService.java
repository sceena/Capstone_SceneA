package com.backend.domain.resume.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.resume.dto.request.ResumeSaveRequest;
import com.backend.domain.resume.dto.response.ResumeSkillDetailInfo;
import com.backend.domain.resume.dto.response.ResumeSkillsResponse;
import com.backend.domain.resume.dto.response.ResumeSaveResponse;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.domain.resume.repository.ResumeSkillRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final ResumeSkillRepository resumeSkillRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public ResumeSaveResponse saveResume(Long memberId, Long sessionId, ResumeSaveRequest request) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        validateMenteeAccess(session, member);

        Resume resume = Resume.builder()
                .interviewSession(session)
                .member(member)
                .content(request.content())
                .build();

        return ResumeSaveResponse.from(resumeRepository.save(resume));
    }

    public ResumeSkillsResponse getResumeSkills(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        boolean isMentor = session.getMentor().getId().equals(memberId);

        Member targetMember;
        if (isMentor) {
            // 멘토가 조회할 때는 세션 참여자(멘티)의 자소서를 반환
            List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session);
            if (participants.isEmpty()) {
                throw new CustomException(ErrorCode.RESUME_NOT_FOUND);
            }
            targetMember = participants.get(0).getMember();
        } else {
            validateSessionAccess(memberId, session);
            targetMember = memberRepository.findById(memberId)
                    .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
        }

        Resume resume = resumeRepository.findByInterviewSessionAndMember(session, targetMember)
                .orElseThrow(() -> new CustomException(ErrorCode.RESUME_NOT_FOUND));

        List<ResumeSkillDetailInfo> skills = resumeSkillRepository.findAllByResume(resume)
                .stream()
                .map(ResumeSkillDetailInfo::from)
                .toList();

        return new ResumeSkillsResponse(resume.getId(), skills);
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
