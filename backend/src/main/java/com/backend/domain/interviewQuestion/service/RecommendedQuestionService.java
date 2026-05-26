package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiQuestionGenerationClient;
import com.backend.domain.ai.dto.request.AiQuestionCandidateRequest;
import com.backend.domain.ai.dto.request.AiSessionQuestionGenerationRequest;
import com.backend.domain.ai.dto.response.AiPersonalQuestionResponse;
import com.backend.domain.ai.dto.response.AiSessionQuestionGenerationResponse;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestion;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestionBatch;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestionStatus;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestionType;
import com.backend.domain.interviewQuestion.repository.RecommendedQuestionBatchRepository;
import com.backend.domain.interviewQuestion.repository.RecommendedQuestionRepository;
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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecommendedQuestionService {

    private static final String ONE_TO_ONE = "ONE_TO_ONE";
    private static final String GROUP = "GROUP";

    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ResumeRepository resumeRepository;
    private final RecommendedQuestionBatchRepository batchRepository;
    private final RecommendedQuestionRepository recommendedQuestionRepository;
    private final AiQuestionGenerationClient aiQuestionGenerationClient;

    @Transactional(noRollbackFor = CustomException.class)
    public AiSessionQuestionGenerationResponse generateRecommendedQuestions(Long mentorId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        validateMentorAccess(mentorId, session);

        RecommendedQuestionBatch batch = batchRepository.findByInterviewSession(session)
                .orElseGet(() -> batchRepository.save(RecommendedQuestionBatch.builder()
                        .interviewSession(session)
                        .sessionType(ONE_TO_ONE)
                        .build()));

        if (batch.getStatus() == RecommendedQuestionStatus.COMPLETED) {
            List<RecommendedQuestion> savedQuestions = recommendedQuestionRepository
                    .findAllByBatchOrderByTypeAscCandidateIdAscOrderIndexAsc(batch);
            if (!savedQuestions.isEmpty()) {
                return toResponse(batch, savedQuestions);
            }
        }

        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session).stream()
                .sorted(Comparator.comparing(participant -> participant.getMember().getId()))
                .toList();

        if (participants.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        List<AiQuestionCandidateRequest> candidates = participants.stream()
                .map(participant -> toCandidateRequest(session, participant))
                .toList();

        String sessionType = resolveSessionType(candidates);
        batch.markPending(sessionType);
        recommendedQuestionRepository.deleteAllByBatch(batch);

        AiSessionQuestionGenerationRequest request = new AiSessionQuestionGenerationRequest(
                sessionType,
                candidates
        );

        try {
            AiSessionQuestionGenerationResponse response = aiQuestionGenerationClient.generateSessionQuestions(request);
            saveQuestions(batch, response);
            batch.markCompleted(response.sessionType());
            return response;
        } catch (CustomException e) {
            batch.markFailed(e.getMessage());
            throw e;
        }
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

    private void saveQuestions(RecommendedQuestionBatch batch, AiSessionQuestionGenerationResponse response) {
        List<RecommendedQuestion> questions = new ArrayList<>();

        for (int i = 0; i < response.commonQuestions().size(); i++) {
            questions.add(RecommendedQuestion.builder()
                    .batch(batch)
                    .type(RecommendedQuestionType.COMMON)
                    .candidateId(null)
                    .content(response.commonQuestions().get(i))
                    .orderIndex(i)
                    .build());
        }

        for (AiPersonalQuestionResponse personalQuestion : response.personalQuestions()) {
            List<String> personalQuestions = personalQuestion.questions();
            for (int i = 0; i < personalQuestions.size(); i++) {
                questions.add(RecommendedQuestion.builder()
                        .batch(batch)
                        .type(RecommendedQuestionType.PERSONAL)
                        .candidateId(personalQuestion.candidateId())
                        .content(personalQuestions.get(i))
                        .orderIndex(i)
                        .build());
            }
        }

        recommendedQuestionRepository.saveAll(questions);
    }

    private AiSessionQuestionGenerationResponse toResponse(
            RecommendedQuestionBatch batch,
            List<RecommendedQuestion> savedQuestions) {
        List<String> commonQuestions = savedQuestions.stream()
                .filter(question -> question.getType() == RecommendedQuestionType.COMMON)
                .map(RecommendedQuestion::getContent)
                .toList();

        Map<Long, List<String>> personalQuestionMap = new LinkedHashMap<>();
        savedQuestions.stream()
                .filter(question -> question.getType() == RecommendedQuestionType.PERSONAL)
                .forEach(question -> personalQuestionMap
                        .computeIfAbsent(question.getCandidateId(), ignored -> new ArrayList<>())
                        .add(question.getContent()));

        List<AiPersonalQuestionResponse> personalQuestions = personalQuestionMap.entrySet().stream()
                .map(entry -> new AiPersonalQuestionResponse(entry.getKey(), entry.getValue()))
                .toList();

        return new AiSessionQuestionGenerationResponse(
                batch.getSessionType(),
                commonQuestions,
                personalQuestions
        );
    }

    private void validateMentorAccess(Long mentorId, InterviewSession session) {
        if (!session.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
