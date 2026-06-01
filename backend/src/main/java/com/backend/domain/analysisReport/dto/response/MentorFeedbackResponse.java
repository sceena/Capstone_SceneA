package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record MentorFeedbackResponse(
        Long id,
        @JsonProperty("report_status") String reportStatus,
        @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static MentorFeedbackResponse from(AnalysisReport report) {
        return new MentorFeedbackResponse(
                report.getId(),
                report.getReportStatus().name().toLowerCase(),
                report.getMentorFeedback(),
                report.getMentorScore(),
                report.getModifyDate()
        );
    }
}
