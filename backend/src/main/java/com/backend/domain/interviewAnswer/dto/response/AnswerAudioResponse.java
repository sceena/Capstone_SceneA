package com.backend.domain.interviewAnswer.dto.response;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public record AnswerAudioResponse(
        Resource resource,
        MediaType contentType,
        String filename
) {
}
