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
import com.backend.domain.member.entity.Member;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${ai.question-generation.allow-missing-resume-fallback:false}")
    private boolean allowMissingResumeFallback;

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
        Member member = participant.getMember();
        String content = resumeRepository.findByInterviewSessionAndMember(session, member)
                .map(Resume::getContent)
                .orElseGet(() -> {
                    if (!allowMissingResumeFallback) {
                        throw new CustomException(ErrorCode.RESUME_NOT_FOUND);
                    }
                    return buildFallbackResumeContent(session, member);
                });

        return new AiQuestionCandidateRequest(
                member.getId(),
                member.getName(),
                content
        );
    }

    private String buildFallbackResumeContent(InterviewSession session, Member member) {
        String jobCategory = session.getJobCategory() != null ? session.getJobCategory() : "IT 개발";
        return """
                지원자 이름: %s
                희망 직무: %s
                개발용 테스트 데이터입니다. 실제 자기소개서가 아직 세션에 연결되지 않아, 추천 질문 화면 확인을 위해 임시 문서를 사용합니다.
                지원자는 Spring Boot 기반 프로젝트 경험이 있으며 REST API 설계, 데이터베이스 연동, 성능 개선, 예외 처리, 협업 경험을 중심으로 면접 질문을 받을 수 있습니다.
                실제 서비스에서는 지원자가 제출한 이력서와 자기소개서 원문을 기반으로 추천 질문을 생성해야 합니다.
                """.formatted(member.getName(), jobCategory);
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
