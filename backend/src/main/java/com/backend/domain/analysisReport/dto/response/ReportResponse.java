package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ReportResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("report_status") String reportStatus,
        @JsonProperty("total_score") Float totalScore,
        @JsonProperty("alignment_score") Float alignmentScore,
        @JsonProperty("best_moment") String bestMoment,
        @JsonProperty("worst_moment") String worstMoment,
        @JsonProperty("ai_summary") String aiSummary,
        @JsonProperty("raw_ai_response_json") String rawAiResponseJson,
        @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public ReportResponse(Long id, Long sessionId, String reportStatus, Float totalScore,
                          Float alignmentScore, String bestMoment, String worstMoment,
                          String mentorFeedback, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, sessionId, reportStatus, totalScore, alignmentScore, bestMoment, worstMoment,
                null, null, mentorFeedback, createdAt, updatedAt);
    }

    public static ReportResponse from(AnalysisReport report) {
        return new ReportResponse(
                report.getId(),
                report.getInterviewSession().getId(),
                report.getReportStatus().name().toLowerCase(),
                report.getTotalScore(),
                report.getAlignmentScore(),
                report.getBestMoment(),
                report.getWorstMoment(),
                report.getAiSummary(),
                report.getRawAiResponseJson(),
                report.getMentorFeedback(),
                report.getCreateDate(),
                report.getModifyDate()
        );
    }
}
