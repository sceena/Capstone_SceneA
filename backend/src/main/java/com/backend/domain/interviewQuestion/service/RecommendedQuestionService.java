package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiQuestionGenerationClient;
import com.backend.domain.ai.dto.request.AiQuestionCandidateRequest;
import com.backend.domain.ai.dto.request.AiSessionQuestionGenerationRequest;
import com.backend.domain.ai.dto.response.AiSessionQuestionGenerationResponse;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecommendedQuestionService {

    private static final String ONE_TO_ONE = "ONE_TO_ONE";
    private static final String GROUP = "GROUP";

    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ResumeRepository resumeRepository;
    private final AiQuestionGenerationClient aiQuestionGenerationClient;

    public AiSessionQuestionGenerationResponse generateRecommendedQuestions(Long mentorId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        validateMentorAccess(mentorId, session);

        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session).stream()
                .sorted(Comparator.comparing(participant -> participant.getMember().getId()))
                .toList();

        if (participants.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        List<AiQuestionCandidateRequest> candidates = participants.stream()
                .map(participant -> toCandidateRequest(session, participant))
                .toList();

        AiSessionQuestionGenerationRequest request = new AiSessionQuestionGenerationRequest(
                resolveSessionType(candidates),
                candidates
        );

        return aiQuestionGenerationClient.generateSessionQuestions(request);
    }

    private AiQuestionCandidateRequest toCandidateRequest(InterviewSession session, SessionParticipant participant) {
        Resume resume = resumeRepository
                .findByInterviewSessionAndMember(session, participant.getMember())
                .orElseThrow(() -> new CustomException(ErrorCode.RESUME_NOT_FOUND));

        return new AiQuestionCandidateRequest(
                participant.getMember().getId(),
                participant.getMember().getName(),
                resume.getContent()
        );
    }

    private String resolveSessionType(List<AiQuestionCandidateRequest> candidates) {
        return candidates.size() == 1 ? ONE_TO_ONE : GROUP;
    }

    private void validateMentorAccess(Long mentorId, InterviewSession session) {
        if (!session.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
