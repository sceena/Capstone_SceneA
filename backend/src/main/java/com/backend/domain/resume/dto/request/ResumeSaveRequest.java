package com.backend.domain.resume.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ResumeSaveRequest(
        @NotBlank String content
) {}
