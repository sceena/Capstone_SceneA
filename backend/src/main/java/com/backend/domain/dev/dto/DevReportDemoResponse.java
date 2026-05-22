package com.backend.domain.dev.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DevReportDemoResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("mentor_access_token") String mentorAccessToken,
        @JsonProperty("mentee_access_token") String menteeAccessToken,
        @JsonProperty("generate_report_url") String generateReportUrl,
        @JsonProperty("get_report_url") String getReportUrl
) {
}
