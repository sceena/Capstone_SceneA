package com.backend.domain.interviewSession.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ParticipantStatusRequest(
        @JsonProperty("answer_status") String answerStatus
) {}
