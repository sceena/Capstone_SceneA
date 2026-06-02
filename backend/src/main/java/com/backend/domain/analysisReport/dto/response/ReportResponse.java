package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.ai.dto.response.AiQuestionReportResponse;
import com.backend.domain.ai.dto.response.AiQuestionHighlightResponse;
import com.backend.domain.ai.dto.response.AiReplayResponse;
import com.backend.domain.ai.dto.response.AiReportResponse;
import com.backend.domain.ai.dto.response.AiTopSummaryResponse;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.entity.MenteeReportFeedback;
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
        @JsonProperty("mentee_report_feedbacks") List<MenteeReportFeedbackResponse> menteeReportFeedbacks,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public ReportResponse(Long id, Long sessionId, String reportStatus, Float totalScore,
                          Float alignmentScore, String bestMoment, String worstMoment,
                          String mentorFeedback, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, sessionId, reportStatus, totalScore, alignmentScore, bestMoment, worstMoment,
                null, null, List.of(), null, mentorFeedback, null, List.of(), createdAt, updatedAt);
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
        return from(report, aiReport, answerEvaluations, null, List.of());
    }

    public static ReportResponse from(
            AnalysisReport report,
            AiReportResponse aiReport,
            List<AnswerEvaluationResponse> answerEvaluations,
            MenteeReportFeedback selectedFeedback,
            List<MenteeReportFeedback> menteeFeedbacks
    ) {
        List<AnswerEvaluationResponse> evaluations = answerEvaluations == null ? List.of() : answerEvaluations;
        List<MenteeReportFeedbackResponse> feedbackResponses = menteeFeedbacks == null
                ? List.of()
                : menteeFeedbacks.stream().map(MenteeReportFeedbackResponse::from).toList();
        AiReportResponse mergedAiReport = mergeMentorEvaluations(aiReport, evaluations);
        return new ReportResponse(
                report.getId(),
                report.getInterviewSession().getId(),
                resolveReportStatus(report, selectedFeedback),
                mergedAiReport == null ? report.getTotalScore() : mergedAiReport.overallScore(),
                report.getAlignmentScore(),
                report.getBestMoment(),
                report.getWorstMoment(),
                report.getAiSummary(),
                mergedAiReport,
                evaluations,
                report.getRawAiResponseJson(),
                selectedFeedback == null ? report.getMentorFeedback() : selectedFeedback.getMentorFeedback(),
                selectedFeedback == null ? report.getMentorScore() : selectedFeedback.getMentorScore(),
                feedbackResponses,
                report.getCreateDate(),
                report.getModifyDate()
        );
    }

    private static String resolveReportStatus(AnalysisReport report, MenteeReportFeedback selectedFeedback) {
        if (selectedFeedback != null) {
            return "final";
        }
        return report.getReportStatus().name().toLowerCase();
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
        Map<String, AnswerEvaluationResponse> uniqueByQuestionId = new HashMap<>();
        for (AnswerEvaluationResponse evaluation : evaluations) {
            if (evaluation.answerId() != null) {
                byAnswerId.put(String.valueOf(evaluation.answerId()), evaluation);
            }
            if (evaluation.questionId() != null && evaluation.menteeId() != null) {
                byQuestionMentee.put(evaluation.questionId() + ":" + evaluation.menteeId(), evaluation);
            }
            if (evaluation.questionId() != null) {
                String key = String.valueOf(evaluation.questionId());
                uniqueByQuestionId.put(key, uniqueByQuestionId.containsKey(key) ? null : evaluation);
            }
        }

        List<AiQuestionReportResponse> mergedQuestionReports = aiReport.questionReports().stream()
                .map(questionReport -> mergeQuestionReport(
                        questionReport,
                        findEvaluation(questionReport, byAnswerId, byQuestionMentee, uniqueByQuestionId)
                ))
                .toList();

        return new AiReportResponse(
                aiReport.sessionId(),
                recalculateOverallScore(mergedQuestionReports),
                rebuildTopSummary(aiReport.topSummary(), mergedQuestionReports),
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

    private static Float recalculateOverallScore(List<AiQuestionReportResponse> questionReports) {
        List<Float> scores = questionReports.stream()
                .map(AiQuestionReportResponse::score)
                .filter(score -> score != null)
                .map(ReportResponse::toFivePointScore)
                .toList();
        if (scores.isEmpty()) {
            return null;
        }
        float sum = 0.0f;
        for (Float score : scores) {
            sum += score;
        }
        return Math.round((sum / scores.size()) * 10.0f) / 10.0f;
    }

    private static AiTopSummaryResponse rebuildTopSummary(
            AiTopSummaryResponse originalTopSummary,
            List<AiQuestionReportResponse> questionReports
    ) {
        if (questionReports.isEmpty()) {
            return originalTopSummary;
        }

        AiQuestionReportResponse best = questionReports.stream()
                .filter(report -> report.score() != null)
                .max((left, right) -> Float.compare(toFivePointScore(left.score()), toFivePointScore(right.score())))
                .orElse(null);
        AiQuestionReportResponse worst = questionReports.stream()
                .filter(report -> report.score() != null)
                .min((left, right) -> Float.compare(toFivePointScore(left.score()), toFivePointScore(right.score())))
                .orElse(null);

        if (best == null || worst == null) {
            return originalTopSummary;
        }

        return new AiTopSummaryResponse(
                toHighlight(best, originalTopSummary == null ? null : originalTopSummary.bestQuestion()),
                toHighlight(worst, originalTopSummary == null ? null : originalTopSummary.worstQuestion())
        );
    }

    private static AiQuestionHighlightResponse toHighlight(
            AiQuestionReportResponse questionReport,
            AiQuestionHighlightResponse originalHighlight
    ) {
        return new AiQuestionHighlightResponse(
                questionReport.questionId(),
                questionReport.question(),
                firstNonBlank(questionReport.reasoning(), originalHighlight == null ? null : originalHighlight.reason()),
                originalHighlight == null ? null : originalHighlight.metricsSummary()
        );
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
                evaluation.mentorScore() == null ? questionReport.score() : toFivePointScore(evaluation.mentorScore()),
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

    private static Float toFivePointScore(Float score) {
        if (score == null) {
            return null;
        }
        return Math.max(1.0f, Math.min(5.0f, score > 5.0f ? score / 2.0f : score));
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
