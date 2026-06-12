package com.backend.global.oauth;

import com.backend.domain.member.entity.MemberProvider;

import java.util.Map;

public record OAuthAttributes(
        String providerId,
        String email,
        String name,
        String nickname,
        MemberProvider provider,
        String profileImageUrl
) {
    public static OAuthAttributes of(String registrationId, Map<String, Object> attributes) {
        return switch (registrationId.toLowerCase()) {
            case "google" -> ofGoogle(attributes);
            case "kakao" -> ofKakao(attributes);
            case "naver" -> ofNaver(attributes);
            default -> throw new IllegalArgumentException("Unsupported provider: " + registrationId);
        };
    }

    private static OAuthAttributes ofGoogle(Map<String, Object> attributes) {
        return new OAuthAttributes(
                String.valueOf(attributes.get("id")),
                (String) attributes.get("email"),
                (String) attributes.get("name"),
                (String) attributes.get("name"),
                MemberProvider.GOOGLE,
                (String) attributes.get("picture")
        );
    }

    @SuppressWarnings("unchecked")
    private static OAuthAttributes ofKakao(Map<String, Object> attributes) {
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
        return new OAuthAttributes(
                String.valueOf(attributes.get("id")),
                null,
                (String) profile.get("nickname"),
                (String) profile.get("nickname"),
                MemberProvider.KAKAO,
                (String) profile.get("profile_image_url")
        );
    }

    @SuppressWarnings("unchecked")
    private static OAuthAttributes ofNaver(Map<String, Object> attributes) {
        Map<String, Object> response = (Map<String, Object>) attributes.get("response");
        String nickname = (String) response.get("nickname");
        String name = (String) response.get("name");
        return new OAuthAttributes(
                (String) response.get("id"),
                (String) response.get("email"),
                name,
                nickname != null ? nickname : name,
                MemberProvider.NAVER,
                (String) response.get("profile_image")
        );
    }
}
