package com.backend.domain.tag.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record TagRequest(
        @Schema(description = "태그 이름", example = "자바") String name,
        @Schema(description = "태그 카테고리", example = "기술스택") String category
) {}
