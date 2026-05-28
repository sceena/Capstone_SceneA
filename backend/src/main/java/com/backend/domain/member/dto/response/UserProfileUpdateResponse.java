package com.backend.domain.member.dto.response;

import com.backend.domain.member.entity.Member;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record UserProfileUpdateResponse(
        Long id,
        String name,
        String bio,
        @JsonProperty("profile_image_url") String profileImageUrl,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static UserProfileUpdateResponse from(Member member) {
        return new UserProfileUpdateResponse(
                member.getId(),
                member.getName(),
                member.getBio(),
                member.getProfileImageUrl(),
                LocalDateTime.now()
        );
    }
}
