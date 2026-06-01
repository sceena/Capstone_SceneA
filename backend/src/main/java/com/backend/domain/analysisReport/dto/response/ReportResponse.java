package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.ai.dto.response.AiQuestionReportResponse;
import com.backend.domain.ai.dto.response.AiReplayResponse;
import com.backend.domain.ai.dto.response.AiReportResponse;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.answerEvaluation.dto.response.AnswerEvaluationResponse;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public record ReportResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("report_status") String reportStatus,
        @JsonProperty("total_score") Float totalScore,
        @JsonProperty("alignment_score") Float alignmentScore,
        @JsonProperty("best_moment") String bestMoment,
        @JsonProperty("worst_moment") String worstMoment,
        @JsonProperty("ai_summary") String aiSummary,
        @JsonProperty("ai_report") AiReportResponse aiReport,
        @JsonProperty("answer_evaluations") List<AnswerEvaluationResponse> answerEvaluations,
        @JsonProperty("raw_ai_response_json") String rawAiResponseJson,
        @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public ReportResponse(Long id, Long sessionId, String reportStatus, Float totalScore,
                          Float alignmentScore, String bestMoment, String worstMoment,
                          String mentorFeedback, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, sessionId, reportStatus, totalScore, alignmentScore, bestMoment, worstMoment,
                null, null, List.of(), null, mentorFeedback, null, createdAt, updatedAt);
    }

    public static ReportResponse from(AnalysisReport report) {
        return from(report, null);
    }

    public static ReportResponse from(AnalysisReport report, AiReportResponse aiReport) {
        return from(report, aiReport, List.of());
    }

    public static ReportResponse from(
            AnalysisReport report,
            AiReportResponse aiReport,
            List<AnswerEvaluationResponse> answerEvaluations
    ) {
        List<AnswerEvaluationResponse> evaluations = answerEvaluations == null ? List.of() : answerEvaluations;
        return new ReportResponse(
                report.getId(),
                report.getInterviewSession().getId(),
                report.getReportStatus().name().toLowerCase(),
                report.getTotalScore(),
                report.getAlignmentScore(),
                report.getBestMoment(),
                report.getWorstMoment(),
                report.getAiSummary(),
                mergeMentorEvaluations(aiReport, evaluations),
                evaluations,
                report.getRawAiResponseJson(),
                report.getMentorFeedback(),
                report.getMentorScore(),
                report.getCreateDate(),
                report.getModifyDate()
        );
    }

    private static AiReportResponse mergeMentorEvaluations(
            AiReportResponse aiReport,
            List<AnswerEvaluationResponse> evaluations
    ) {
        if (aiReport == null || aiReport.questionReports() == null || aiReport.questionReports().isEmpty()) {
            return aiReport;
        }

        Map<String, AnswerEvaluationResponse> byAnswerId = new HashMap<>();
        Map<String, AnswerEvaluationResponse> byQuestionMentee = new HashMap<>();
        Map<String, AnswerEvaluationResponse> byQuestionId = new HashMap<>();
        for (AnswerEvaluationResponse evaluation : evaluations) {
            if (evaluation.answerId() != null) {
                byAnswerId.put(String.valueOf(evaluation.answerId()), evaluation);
            }
            if (evaluation.questionId() != null && evaluation.menteeId() != null) {
                byQuestionMentee.put(evaluation.questionId() + ":" + evaluation.menteeId(), evaluation);
            }
            if (evaluation.questionId() != null) {
                byQuestionId.putIfAbsent(String.valueOf(evaluation.questionId()), evaluation);
            }
        }

        List<AiQuestionReportResponse> mergedQuestionReports = aiReport.questionReports().stream()
                .map(questionReport -> mergeQuestionReport(
                        questionReport,
                        findEvaluation(questionReport, byAnswerId, byQuestionMentee, byQuestionId)
                ))
                .toList();

        return new AiReportResponse(
                aiReport.sessionId(),
                aiReport.overallScore(),
                aiReport.topSummary(),
                aiReport.fitGap(),
                mergedQuestionReports
        );
    }

    private static AnswerEvaluationResponse findEvaluation(
            AiQuestionReportResponse questionReport,
            Map<String, AnswerEvaluationResponse> byAnswerId,
            Map<String, AnswerEvaluationResponse> byQuestionMentee,
            Map<String, AnswerEvaluationResponse> byQuestionId
    ) {
        if (questionReport.answerId() != null) {
            AnswerEvaluationResponse evaluation = byAnswerId.get(String.valueOf(questionReport.answerId()));
            if (evaluation != null) {
                return evaluation;
            }
        }
        if (questionReport.questionId() != null && questionReport.menteeId() != null) {
            AnswerEvaluationResponse evaluation = byQuestionMentee.get(questionReport.questionId() + ":" + questionReport.menteeId());
            if (evaluation != null) {
                return evaluation;
            }
        }
        if (questionReport.questionId() != null) {
            return byQuestionId.get(String.valueOf(questionReport.questionId()));
        }
        return null;
    }

    private static AiQuestionReportResponse mergeQuestionReport(
            AiQuestionReportResponse questionReport,
            AnswerEvaluationResponse evaluation
    ) {
        if (evaluation == null || !hasMentorRevision(evaluation)) {
            return questionReport;
        }

        return new AiQuestionReportResponse(
                firstNonNull(questionReport.questionId(), evaluation.questionId()),
                firstNonNull(questionReport.answerId(), evaluation.answerId()),
                firstNonNull(questionReport.menteeId(), evaluation.menteeId()),
                questionReport.menteeName(),
                firstNonBlank(evaluation.questionText(), questionReport.question()),
                firstNonBlank(evaluation.answerText(), questionReport.answer()),
                evaluation.mentorScore() == null ? questionReport.score() : toAiReportScore(evaluation.mentorScore()),
                firstNonBlank(evaluation.mentorReasoning(), questionReport.reasoning()),
                firstNonEmpty(evaluation.mentorStrengths(), questionReport.strengths()),
                firstNonEmpty(evaluation.mentorImprovements(), questionReport.improvements()),
                questionReport.evaluationSource(),
                questionReport.aiModelName(),
                questionReport.promptVersion(),
                mergeReplay(questionReport.replay(), evaluation.audioUrl())
        );
    }

    private static boolean hasMentorRevision(AnswerEvaluationResponse evaluation) {
        return !isBlank(evaluation.mentorReasoning())
                || evaluation.mentorScore() != null
                || !isEmpty(evaluation.mentorStrengths())
                || !isEmpty(evaluation.mentorImprovements());
    }

    private static Float toAiReportScore(Float mentorScore) {
        if (mentorScore == null) {
            return null;
        }
        return mentorScore <= 5.0f ? mentorScore * 2.0f : mentorScore;
    }

    private static AiReplayResponse mergeReplay(AiReplayResponse replay, String audioUrl) {
        if (replay != null || isBlank(audioUrl)) {
            return replay;
        }
        return new AiReplayResponse(audioUrl, null, null);
    }

    private static <T> T firstNonNull(T first, T second) {
        return first != null ? first : second;
    }

    private static String firstNonBlank(String first, String second) {
        return isBlank(first) ? second : first;
    }

    private static List<String> firstNonEmpty(List<String> first, List<String> second) {
        return isEmpty(first) ? (second == null ? List.of() : second) : first;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isEmpty(List<String> values) {
        return values == null || values.isEmpty();
    }
}
