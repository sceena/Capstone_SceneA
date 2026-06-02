package com.backend.domain.member.dto.response;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.entity.MenteeReportFeedback;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record SessionHistoryItemResponse(
        Long id,
        @JsonProperty("job_category") String jobCategory,
        String status,
        @JsonProperty("report_status") String reportStatus,
        @JsonProperty("started_at") LocalDateTime startedAt
) {
    public static SessionHistoryItemResponse of(InterviewSession session, AnalysisReport report) {
        return of(session, report, null);
    }

    public static SessionHistoryItemResponse of(
            InterviewSession session,
            AnalysisReport report,
            MenteeReportFeedback feedback
    ) {
        return new SessionHistoryItemResponse(
                session.getId(),
                session.getJobCategory(),
                session.getStatus().name().toLowerCase(),
                feedback != null ? "final" : report != null ? report.getReportStatus().name().toLowerCase() : null,
                session.getStartedAt()
        );
    }
}
