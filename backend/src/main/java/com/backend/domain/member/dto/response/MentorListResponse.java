package com.backend.domain.member.dto.response;

import com.backend.domain.member.entity.Member;
import com.backend.domain.tag.entity.MemberTag;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.domain.Page;

import java.util.List;

public record MentorListResponse(
        Long id,
        String name,
        String nickname,
        String bio,
        @JsonProperty("profile_image_url") String profileImageUrl,
        List<TagInfo> tags
) {
    public record TagInfo(Long id, String name, String category) {}

    public record PageResponse(
            List<MentorListResponse> content,
            @JsonProperty("total_elements") long totalElements,
            @JsonProperty("total_pages") int totalPages
    ) {
        public static PageResponse of(Page<MentorListResponse> page) {
            return new PageResponse(page.getContent(), page.getTotalElements(), page.getTotalPages());
        }
    }

    public static MentorListResponse of(Member member, List<MemberTag> memberTags) {
        List<TagInfo> tags = memberTags.stream()
                .map(mt -> new TagInfo(mt.getTag().getId(), mt.getTag().getName(), mt.getTag().getCategory()))
                .toList();
        return new MentorListResponse(
                member.getId(),
                member.getName(),
                member.getNickname(),
                member.getBio(),
                member.getProfileImageUrl(),
                tags
        );
    }
}
