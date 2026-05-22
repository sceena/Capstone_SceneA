package com.backend.domain.member.dto.request;

import com.backend.domain.member.entity.Role;
import com.backend.domain.tag.dto.TagRequest;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record SignupRequest(
        @Schema(example = "user@example.com") String email,
        @Schema(example = "password123!") String password,
        @Schema(example = "홍길동") String name,
        @Schema(example = "길동이") String nickname,
        @Schema(example = "MENTEE") Role role,
        @Schema(description = "태그 목록. null이면 태그 없이 가입",
                example = "[{\"name\": \"자바\", \"category\": \"기술스택\"}, {\"name\": \"3년\", \"category\": \"근속년수\"}]")
        List<TagRequest> tags
) {}
