package com.backend.domain.interviewAnswer.dto.response;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record MentorScoreResponse(
        Long id,
        @JsonProperty("ai_score") Float aiScore,
        @JsonProperty("mentor_score") Float mentorScore,
        Float gap,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static MentorScoreResponse from(InterviewAnswer answer) {
        return new MentorScoreResponse(
                answer.getId(),
                answer.getAiScore(),
                answer.getMentorScore(),
                answer.getGap(),
                answer.getModifyDate()
        );
    }
}
