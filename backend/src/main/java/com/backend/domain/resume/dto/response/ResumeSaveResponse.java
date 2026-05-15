package com.backend.domain.resume.dto.response;

import com.backend.domain.resume.entity.Resume;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record ResumeSaveResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        String content,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static ResumeSaveResponse from(Resume resume) {
        return new ResumeSaveResponse(
                resume.getId(),
                resume.getInterviewSession().getId(),
                resume.getContent(),
                resume.getCreateDate()
        );
    }
}
