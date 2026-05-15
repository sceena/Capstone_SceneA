package com.backend.domain.ai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiReportResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("overall_score") Float overallScore,
        @JsonProperty("top_summary") AiTopSummaryResponse topSummary,
        @JsonProperty("fit_gap") AiFitGapResponse fitGap,
        @JsonProperty("question_reports") List<AiQuestionReportResponse> questionReports
) {
}
