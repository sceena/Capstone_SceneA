package com.backend.domain.member.dto.request;

public record UserProfileUpdateRequest(
        String name,
        String password
) {
}
