package com.backend.domain.member.dto.response;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.entity.MenteeReportFeedback;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.Map;

public record MySessionHistoryResponse(
        List<SessionHistoryItemResponse> content,
        @JsonProperty("total_elements") long totalElements,
        @JsonProperty("total_pages") int totalPages
) {
    public static MySessionHistoryResponse of(Page<InterviewSession> page, Map<Long, AnalysisReport> reportMap) {
        return of(page, reportMap, Map.of());
    }

    public static MySessionHistoryResponse of(
            Page<InterviewSession> page,
            Map<Long, AnalysisReport> reportMap,
            Map<Long, MenteeReportFeedback> feedbackMap
    ) {
        List<SessionHistoryItemResponse> content = page.getContent().stream()
                .map(session -> SessionHistoryItemResponse.of(
                        session,
                        reportMap.get(session.getId()),
                        feedbackMap.get(session.getId())
                ))
                .toList();
        return new MySessionHistoryResponse(content, page.getTotalElements(), page.getTotalPages());
    }
}
