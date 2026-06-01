package com.backend.domain.answerEvaluation.service;

import com.backend.domain.ai.dto.response.AiQuestionReportResponse;
import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.answerEvaluation.dto.request.MentorEvaluationRequest;
import com.backend.domain.answerEvaluation.dto.response.AnswerEvaluationResponse;
import com.backend.domain.answerEvaluation.dto.response.EvaluationJsonMapper;
import com.backend.domain.answerEvaluation.entity.AnswerEvaluation;
import com.backend.domain.answerEvaluation.repository.AnswerEvaluationRepository;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnswerEvaluationService implements EvaluationJsonMapper {

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final AnswerEvaluationRepository evaluationRepository;
    private final InterviewSessionRepository sessionRepository;
    private final InterviewAnswerRepository answerRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void saveAiDrafts(InterviewSession session, List<AiQuestionReportResponse> questionReports) {
        if (questionReports == null || questionReports.isEmpty()) {
            return;
        }

        for (AiQuestionReportResponse questionReport : questionReports) {
            InterviewAnswer answer = findAnswerForAiDraft(session, questionReport);
            if (answer == null) {
                continue;
            }
            AnswerEvaluation evaluation = evaluationRepository.findByInterviewAnswer(answer)
                    .orElseGet(() -> AnswerEvaluation.builder()
                            .interviewAnswer(answer)
                            .questionText(questionReport.question())
                            .answerText(questionReport.answer())
                            .build());

            evaluation.updateAiDraft(
                    questionReport.question(),
                    questionReport.answer(),
                    questionReport.reasoning(),
                    questionReport.score(),
                    toJson(questionReport.strengths()),
                    toJson(questionReport.improvements()),
                    questionReport.aiModelName(),
                    questionReport.promptVersion(),
                    questionReport.evaluationSource()
            );
            evaluationRepository.save(evaluation);

            answer.updateAiScore(toFivePointScale(questionReport.score()));
        }
    }

    @Transactional
    public AnswerEvaluationResponse updateMentorEvaluation(
            Long mentorId,
            Long sessionId,
            Long answerId,
            MentorEvaluationRequest request
    ) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        validateMentorAccess(mentorId, session);

        InterviewAnswer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));
        validateAnswerInSession(answer, session);

        AnswerEvaluation evaluation = saveMentorEvaluation(
                answer,
                request.reasoning(),
                request.score(),
                request.strengths(),
                request.improvements()
        );

        return AnswerEvaluationResponse.from(evaluation, this);
    }

    @Transactional
    public void updateMentorEvaluations(
            Long mentorId,
            InterviewSession session,
            List<MentorFeedbackRequest.MentorAnswerEvaluationPayload> payloads
    ) {
        if (payloads == null || payloads.isEmpty()) {
            return;
        }
        validateMentorAccess(mentorId, session);

        for (MentorFeedbackRequest.MentorAnswerEvaluationPayload payload : payloads) {
            InterviewAnswer answer = answerRepository.findById(payload.answerId())
                    .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));
            validateAnswerInSession(answer, session);
            saveMentorEvaluation(answer, payload.reasoning(), payload.score(), payload.strengths(), payload.improvements());
        }
    }

    public String exportDpoJsonl() {
        StringBuilder jsonl = new StringBuilder();
        for (AnswerEvaluation evaluation : evaluationRepository.findDpoExportCandidates()) {
            if (evaluation.getAiReasoning() == null && evaluation.getAiScore() == null) {
                continue;
            }
            jsonl.append(toJsonLine(toDpoSample(evaluation))).append('\n');
        }
        return jsonl.toString();
    }

    public List<AnswerEvaluationResponse> getEvaluationResponses(InterviewSession session) {
        return evaluationRepository.findAllByInterviewSession(session).stream()
                .map(evaluation -> AnswerEvaluationResponse.from(evaluation, this))
                .toList();
    }

    @Override
    public List<String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private InterviewAnswer findAnswerForAiDraft(InterviewSession session, AiQuestionReportResponse questionReport) {
        if (questionReport.answerId() == null) {
            return null;
        }

        InterviewAnswer answer = answerRepository.findById(questionReport.answerId())
                .orElse(null);
        if (answer == null) {
            return null;
        }
        validateAnswerInSession(answer, session);
        return answer;
    }

    private AnswerEvaluation saveMentorEvaluation(
            InterviewAnswer answer,
            String reasoning,
            Float score,
            List<String> strengths,
            List<String> improvements
    ) {
        AnswerEvaluation evaluation = evaluationRepository.findByInterviewAnswer(answer)
                .orElseGet(() -> AnswerEvaluation.builder()
                        .interviewAnswer(answer)
                        .questionText(answer.getInterviewQuestion().getContent())
                        .answerText(answer.getSttText() == null ? "" : answer.getSttText())
                        .build());

        evaluation.updateMentorEvaluation(
                reasoning,
                score,
                toJson(strengths),
                toJson(improvements)
        );
        answer.updateMentorScore(toFivePointScale(score));
        return evaluationRepository.save(evaluation);
    }

    private void validateMentorAccess(Long mentorId, InterviewSession session) {
        if (!session.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void validateAnswerInSession(InterviewAnswer answer, InterviewSession session) {
        InterviewQuestion question = answer.getInterviewQuestion();
        if (!question.getInterviewSession().getId().equals(session.getId())) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }
    }

    private String toJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? List.of() : values);
        } catch (JsonProcessingException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private String toJsonLine(Map<String, Object> sample) {
        try {
            return objectMapper.writeValueAsString(sample);
        } catch (JsonProcessingException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private Map<String, Object> toDpoSample(AnswerEvaluation evaluation) {
        InterviewAnswer answer = evaluation.getInterviewAnswer();
        InterviewQuestion question = answer.getInterviewQuestion();
        boolean sameAsAi = isSameAsAi(evaluation);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("answer_id", answer.getId());
        metadata.put("session_id", question.getInterviewSession().getId());
        metadata.put("ai_model_name", evaluation.getAiModelName());
        metadata.put("prompt_version", evaluation.getPromptVersion());
        metadata.put("evaluation_source", evaluation.getEvaluationSource());
        metadata.put("same_as_ai", sameAsAi);

        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("prompt", buildPrompt(evaluation));
        sample.put("rejected", buildEvaluationPayload(
                evaluation.getAiReasoning(),
                evaluation.getAiScore(),
                fromJson(evaluation.getAiStrengthsJson()),
                fromJson(evaluation.getAiImprovementsJson())
        ));
        sample.put("chosen", buildEvaluationPayload(
                evaluation.getMentorReasoning(),
                evaluation.getMentorScore(),
                fromJson(evaluation.getMentorStrengthsJson()),
                fromJson(evaluation.getMentorImprovementsJson())
        ));
        sample.put("metadata", metadata);
        return sample;
    }

    private Map<String, Object> buildEvaluationPayload(
            String reasoning,
            Float score,
            List<String> strengths,
            List<String> improvements
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reasoning", reasoning);
        payload.put("overall_score", score);
        payload.put("strengths", strengths);
        payload.put("improvements", improvements);
        return payload;
    }

    private String buildPrompt(AnswerEvaluation evaluation) {
        return "면접 질문:\n" + evaluation.getQuestionText()
                + "\n\n지원자 답변:\n" + evaluation.getAnswerText();
    }

    private boolean isSameAsAi(AnswerEvaluation evaluation) {
        return safeEquals(evaluation.getAiReasoning(), evaluation.getMentorReasoning())
                && safeEquals(evaluation.getAiScore(), evaluation.getMentorScore())
                && safeEquals(evaluation.getAiStrengthsJson(), evaluation.getMentorStrengthsJson())
                && safeEquals(evaluation.getAiImprovementsJson(), evaluation.getMentorImprovementsJson());
    }

    private boolean safeEquals(Object left, Object right) {
        return left == null ? right == null : left.equals(right);
    }

    private Float toFivePointScale(Float tenPointScore) {
        if (tenPointScore == null) {
            return null;
        }
        return Math.max(1.0f, Math.min(5.0f, tenPointScore / 2.0f));
    }
}
