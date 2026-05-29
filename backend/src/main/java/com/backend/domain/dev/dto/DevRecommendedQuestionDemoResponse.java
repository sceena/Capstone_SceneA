package com.backend.domain.dev.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record DevRecommendedQuestionDemoResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("participant_ids") List<Long> participantIds,
        @JsonProperty("mentor_access_token") String mentorAccessToken,
        @JsonProperty("generate_recommendations_url") String generateRecommendationsUrl,
        @JsonProperty("get_questions_url") String getQuestionsUrl
) {
}
