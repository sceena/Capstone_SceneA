package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ParticipantInfo(
        @JsonProperty("user_id") Long userId,
        String name,
        String role,
        @JsonProperty("answer_status") AnswerStatus answerStatus,
        @JsonProperty("joined_at") LocalDateTime joinedAt
) {
    public static ParticipantInfo of(SessionParticipant participant, String role) {
        return new ParticipantInfo(
                participant.getMember().getId(),
                participant.getMember().getName(),
                role,
                participant.getAnswerStatus(),
                participant.getCreateDate()
        );
    }
}
