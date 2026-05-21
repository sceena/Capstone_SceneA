package com.backend.domain.member.dto.response;

import com.backend.domain.member.entity.Member;
import com.backend.domain.tag.entity.MemberTag;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public record UserProfileResponse(
        Long id,
        String name,
        String email,
        String role,
        List<TagInfo> tags,
        @JsonProperty("profile_image_url") String profileImageUrl,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public record TagInfo(Long id, String name, String category) {}

    public static UserProfileResponse of(Member member, List<MemberTag> memberTags) {
        List<TagInfo> tags = memberTags.stream()
                .map(mt -> new TagInfo(mt.getTag().getId(), mt.getTag().getName(), mt.getTag().getCategory()))
                .toList();
        return new UserProfileResponse(
                member.getId(),
                member.getName(),
                member.getEmail(),
                member.getRole().name().toLowerCase(),
                tags,
                member.getProfileImageUrl(),
                member.getCreateDate()
        );
    }
}
