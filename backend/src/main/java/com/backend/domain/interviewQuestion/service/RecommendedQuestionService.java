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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.core.io.ClassPathResource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class RecommendedQuestionService {

    private static final String ONE_TO_ONE = "ONE_TO_ONE";
    private static final String GROUP = "GROUP";

    @Value("${ai.question-generation.allow-missing-resume-fallback:false}")
    private boolean allowMissingResumeFallback;

    private final boolean demoMode = true;


    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ResumeRepository resumeRepository;
    private final RecommendedQuestionBatchRepository batchRepository;
    private final RecommendedQuestionRepository recommendedQuestionRepository;
    private final AiQuestionGenerationClient aiQuestionGenerationClient;
    private final ObjectMapper objectMapper;

    @Transactional(noRollbackFor = CustomException.class)
    public AiSessionQuestionGenerationResponse generateRecommendedQuestions(Long mentorId, Long sessionId) {
        return generateRecommendedQuestions(mentorId, sessionId, null, null);
    }

    @Transactional(noRollbackFor = CustomException.class)
    public AiSessionQuestionGenerationResponse generateRecommendedQuestions(Long mentorId, Long sessionId, String scope, Long candidateId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        validateMentorAccess(mentorId, session);

        RecommendedQuestionBatch batch = batchRepository.findByInterviewSession(session)
                .orElseGet(() -> batchRepository.save(RecommendedQuestionBatch.builder()
                        .interviewSession(session)
                        .sessionType(ONE_TO_ONE)
                        .build()));

        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session).stream()
                .filter(participant -> !participant.getMember().getId().equals(session.getMentor().getId()))
                .sorted(Comparator.comparing(participant -> participant.getMember().getId()))
                .toList();

        if (participants.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        List<AiQuestionCandidateRequest> candidates = participants.stream()
                .map(participant -> toCandidateRequest(session, participant))
                .toList();

        if (batch.getStatus() == RecommendedQuestionStatus.COMPLETED) {
            List<RecommendedQuestion> savedQuestions = recommendedQuestionRepository
                    .findAllByBatchOrderByTypeAscCandidateIdAscOrderIndexAsc(batch);
            if (!savedQuestions.isEmpty()) {
                AiSessionQuestionGenerationResponse savedResponse = toResponse(batch, savedQuestions);
                if (hasRequestedQuestions(savedResponse, scope, candidateId)) {
                    return filterResponse(savedResponse, scope, candidateId);
                }
            }
        }

        String sessionType = resolveSessionType(candidates);
        batch.markPending(sessionType);
        recommendedQuestionRepository.deleteAllByBatch(batch);

        if (demoMode) {
            AiSessionQuestionGenerationResponse response = buildFallbackQuestionResponse(sessionType, candidates);
            response = normalizeResponse(sessionType, candidates, response);
            saveQuestions(batch, response);
            batch.markCompleted(response.sessionType());
            return filterResponse(response, scope, candidateId);
        }

        AiSessionQuestionGenerationRequest request = new AiSessionQuestionGenerationRequest(
                sessionType,
                candidates
        );

        try {
            AiSessionQuestionGenerationResponse response = aiQuestionGenerationClient.generateSessionQuestions(request);
            response = normalizeResponse(sessionType, candidates, response);
            saveQuestions(batch, response);
            batch.markCompleted(response.sessionType());
            return filterResponse(response, scope, candidateId);
        } catch (CustomException e) {
            if (e.getErrorCode() == ErrorCode.AI_SERVER_ERROR) {
                log.warn("AI question generation failed. sessionId={}", sessionId);
            }
            batch.markFailed(e.getMessage());
            throw e;
        }
    }

    private AiSessionQuestionGenerationResponse filterResponse(
            AiSessionQuestionGenerationResponse response,
            String scope,
            Long candidateId) {
        if (scope == null || scope.isBlank()) {
            return response;
        }

        String normalizedScope = scope.trim().toUpperCase();
        if ("COMMON".equals(normalizedScope)) {
            return new AiSessionQuestionGenerationResponse(
                    response.sessionType(),
                    response.commonQuestions() != null ? response.commonQuestions() : List.of(),
                    List.of()
            );
        }

        if ("PERSONAL".equals(normalizedScope)) {
            List<AiPersonalQuestionResponse> personalQuestions = response.personalQuestions() != null
                    ? response.personalQuestions()
                    : List.of();
            if (candidateId != null) {
                personalQuestions = personalQuestions.stream()
                        .filter(question -> candidateId.equals(question.candidateId()))
                        .toList();
            }
            return new AiSessionQuestionGenerationResponse(
                    response.sessionType(),
                    List.of(),
                    personalQuestions
            );
        }

        return response;
    }

    private boolean hasRequestedQuestions(
            AiSessionQuestionGenerationResponse response,
            String scope,
            Long candidateId) {
        if (scope == null || scope.isBlank()) {
            return hasAnyQuestions(response);
        }

        String normalizedScope = scope.trim().toUpperCase();
        if ("COMMON".equals(normalizedScope)) {
            return response.commonQuestions() != null && !response.commonQuestions().isEmpty();
        }

        if ("PERSONAL".equals(normalizedScope)) {
            List<AiPersonalQuestionResponse> personalQuestions = response.personalQuestions() != null
                    ? response.personalQuestions()
                    : List.of();
            return personalQuestions.stream()
                    .filter(personalQuestion -> candidateId == null || candidateId.equals(personalQuestion.candidateId()))
                    .anyMatch(personalQuestion -> personalQuestion.questions() != null && !personalQuestion.questions().isEmpty());
        }

        return hasAnyQuestions(response);
    }

    private boolean hasAnyQuestions(AiSessionQuestionGenerationResponse response) {
        boolean hasCommon = response.commonQuestions() != null && !response.commonQuestions().isEmpty();
        boolean hasPersonal = response.personalQuestions() != null && response.personalQuestions().stream()
                .anyMatch(personalQuestion -> personalQuestion.questions() != null && !personalQuestion.questions().isEmpty());
        return hasCommon || hasPersonal;
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

    private AiSessionQuestionGenerationResponse buildFallbackQuestionResponse(
            String sessionType,
            List<AiQuestionCandidateRequest> candidates
    ) {
        JsonNode recommendedQuestions = loadFallbackRecommendedQuestions();
        List<String> commonQuestions = readStringArray(recommendedQuestions.path("common_questions"));
        List<AiPersonalQuestionResponse> personalQuestions = candidates.stream()
                .map(candidate -> new AiPersonalQuestionResponse(
                        candidate.candidateId(),
                        findFallbackPersonalQuestions(recommendedQuestions.path("personal_questions"), candidate.name())
                ))
                .toList();

        return new AiSessionQuestionGenerationResponse(sessionType, commonQuestions, personalQuestions);
    }

    private JsonNode loadFallbackRecommendedQuestions() {
        try {
            Path path = resolveFallbackJsonPath();
            return objectMapper.readTree(Files.readString(path)).path("recommended_questions");
        } catch (Exception e) {
            log.info("Filesystem fallback.json not found or failed to load, trying classpath. reason={}", e.getMessage());
            try {
                ClassPathResource resource = new ClassPathResource("fallback.json");
                try (InputStream is = resource.getInputStream()) {
                    return objectMapper.readTree(is).path("recommended_questions");
                }
            } catch (IOException ex) {
                log.error("Failed to load classpath fallback.json", ex);
                throw new CustomException(ErrorCode.AI_SERVER_ERROR);
            }
        }
    }

    private Path resolveFallbackJsonPath() {
        List<Path> candidates = List.of(
                Path.of("..", "ai-server", "examples", "fallback", "fallback.json"),
                Path.of("ai-server", "examples", "fallback", "fallback.json"),
                Path.of("examples", "fallback", "fallback.json")
        );

        return candidates.stream()
                .map(Path::toAbsolutePath)
                .map(Path::normalize)
                .filter(Files::exists)
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.AI_SERVER_ERROR));
    }

    private List<String> findFallbackPersonalQuestions(JsonNode personalQuestions, String candidateName) {
        String candidateKey = resolveFallbackCandidateName(candidateName);
        if (candidateKey == null || !personalQuestions.isArray()) {
            return List.of();
        }

        for (JsonNode item : personalQuestions) {
            if (candidateKey.equals(item.path("candidate_name").asText())) {
                return readStringArray(item.path("questions"));
            }
        }
        return List.of();
    }

    private String resolveFallbackCandidateName(String candidateName) {
        if (candidateName == null) {
            return null;
        }
        if (candidateName.contains("지아")) {
            return "최지아";
        }
        if (candidateName.contains("윤진")) {
            return "정윤진";
        }
        if (candidateName.contains("동현")) {
            return "강동현";
        }
        return null;
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }

        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText());
            }
        }
        return values;
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

        List<String> commonQuestions = response.commonQuestions() != null ? response.commonQuestions() : List.of();
        List<AiPersonalQuestionResponse> personalQuestions = response.personalQuestions() != null
                ? response.personalQuestions()
                : List.of();

        for (int i = 0; i < commonQuestions.size(); i++) {
            questions.add(RecommendedQuestion.builder()
                    .batch(batch)
                    .type(RecommendedQuestionType.COMMON)
                    .candidateId(null)
                    .content(commonQuestions.get(i))
                    .orderIndex(i)
                    .build());
        }

        for (AiPersonalQuestionResponse personalQuestion : personalQuestions) {
            List<String> candidateQuestions = personalQuestion.questions() != null
                    ? personalQuestion.questions()
                    : List.of();
            for (int i = 0; i < candidateQuestions.size(); i++) {
                questions.add(RecommendedQuestion.builder()
                        .batch(batch)
                        .type(RecommendedQuestionType.PERSONAL)
                        .candidateId(personalQuestion.candidateId())
                        .content(candidateQuestions.get(i))
                        .orderIndex(i)
                        .build());
            }
        }

        recommendedQuestionRepository.saveAll(questions);
    }

    private AiSessionQuestionGenerationResponse normalizeResponse(
            String sessionType,
            List<AiQuestionCandidateRequest> candidates,
            AiSessionQuestionGenerationResponse response) {
        if (response == null) {
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }

        String resolvedSessionType = response.sessionType() != null ? response.sessionType() : sessionType;
        List<String> commonQuestions = sanitizeQuestions(response.commonQuestions());
        List<AiPersonalQuestionResponse> personalQuestions = response.personalQuestions() != null
                ? response.personalQuestions().stream()
                .map(personalQuestion -> new AiPersonalQuestionResponse(
                        personalQuestion.candidateId(),
                        sanitizeQuestions(personalQuestion.questions())))
                .filter(personalQuestion -> !personalQuestion.questions().isEmpty())
                .toList()
                : List.of();

        if (GROUP.equals(sessionType) && commonQuestions.isEmpty()) {
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }

        if (personalQuestions.isEmpty()) {
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }

        return new AiSessionQuestionGenerationResponse(
                resolvedSessionType,
                commonQuestions,
                personalQuestions
        );
    }

    private List<String> sanitizeQuestions(List<String> questions) {
        if (questions == null) {
            return List.of();
        }

        return questions.stream()
                .filter(question -> question != null && !question.isBlank())
                .map(String::trim)
                .toList();
    }

    private AiSessionQuestionGenerationResponse buildFallbackResponse(
            String sessionType,
            List<AiQuestionCandidateRequest> candidates) {
        List<String> commonQuestions = GROUP.equals(sessionType)
                ? List.of(
                "각자 제출한 서류에서 가장 핵심이라고 생각하는 프로젝트를 하나씩 고르고, 본인의 역할과 결과를 비교해 설명해 주세요.",
                "팀 프로젝트에서 기술 선택이 갈렸던 상황이 있다면 어떤 기준으로 의사결정했는지 설명해 주세요.",
                "운영 중 장애나 성능 문제가 발생했을 때 원인을 좁혀 가는 방식을 구체적으로 설명해 주세요.",
                "협업 과정에서 의견 충돌이 있었던 경험을 바탕으로 조율 방식과 결과를 설명해 주세요.",
                "각자의 경험을 비교했을 때 이 직무에서 가장 중요하다고 생각하는 역량은 무엇인지 설명해 주세요.")
                : List.of();

        List<AiPersonalQuestionResponse> personalQuestions = candidates.stream()
                .map(candidate -> new AiPersonalQuestionResponse(
                        candidate.candidateId(),
                        buildFallbackPersonalQuestions(candidate.content(), ONE_TO_ONE.equals(sessionType) ? 10 : 5)))
                .toList();

        return new AiSessionQuestionGenerationResponse(
                sessionType,
                commonQuestions,
                personalQuestions
        );
    }

    private List<String> buildFallbackPersonalQuestions(String resumeContent, int questionCount) {
        String focus = extractResumeFocus(resumeContent);
        List<String> questions = List.of(
                "자소서에서 언급한 " + focus + " 경험에서 본인이 직접 맡은 역할과 의사결정을 구체적으로 설명해 주세요.",
                focus + " 과정에서 가장 어려웠던 기술적 문제는 무엇이었고, 어떤 방식으로 원인을 분석했나요?",
                focus + " 결과를 수치나 사용자 관점의 변화로 설명할 수 있다면 어떤 지표를 제시할 수 있나요?",
                "해당 경험을 다시 수행한다면 구조, 성능, 협업 방식 중 무엇을 가장 먼저 개선하고 싶나요?",
                "이 경험이 지원 직무에서 요구하는 역량과 어떻게 연결된다고 생각하나요?",
                focus + " 경험에서 본인이 주도적으로 세운 기준이나 원칙이 있었다면 무엇이었나요?",
                "문제가 예상과 다르게 흘러갔던 순간이 있다면 어떤 근거로 다음 행동을 결정했나요?",
                "동료나 사용자에게 받은 피드백 중 가장 의미 있었던 것은 무엇이고, 어떻게 반영했나요?",
                focus + " 경험을 통해 새롭게 익힌 기술이나 업무 방식이 있다면 실제로 어떻게 적용했나요?",
                "면접관에게 이 경험의 성과를 가장 설득력 있게 보여주기 위해 어떤 근거를 제시하겠나요?"
        );
        return questions.subList(0, Math.min(questionCount, questions.size()));
    }

    private String extractResumeFocus(String resumeContent) {
        if (resumeContent == null || resumeContent.isBlank()) {
            return "프로젝트";
        }

        String normalized = resumeContent
                .replaceAll("\\[[^\\]]+]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) {
            return "프로젝트";
        }

        int endIndex = Math.min(normalized.length(), 36);
        return normalized.substring(0, endIndex);
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
