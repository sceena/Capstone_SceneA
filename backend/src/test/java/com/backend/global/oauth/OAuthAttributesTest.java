package com.backend.global.oauth;

import com.backend.domain.member.entity.MemberProvider;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OAuthAttributesTest {

    @Test
    void Google_속성_파싱_성공() {
        Map<String, Object> attributes = Map.of(
                "id", "google-sub-123",
                "email", "user@gmail.com",
                "name", "홍길동"
        );

        OAuthAttributes result = OAuthAttributes.of("google", attributes);

        assertThat(result.providerId()).isEqualTo("google-sub-123");
        assertThat(result.email()).isEqualTo("user@gmail.com");
        assertThat(result.name()).isEqualTo("홍길동");
        assertThat(result.provider()).isEqualTo(MemberProvider.GOOGLE);
    }

    @Test
    void Kakao_속성_파싱_성공() {
        Map<String, Object> profile = Map.of("nickname", "길동이");
        Map<String, Object> kakaoAccount = Map.of("profile", profile);
        Map<String, Object> attributes = Map.of("id", 99999L, "kakao_account", kakaoAccount);

        OAuthAttributes result = OAuthAttributes.of("kakao", attributes);

        assertThat(result.providerId()).isEqualTo("99999");
        assertThat(result.email()).isNull();
        assertThat(result.nickname()).isEqualTo("길동이");
        assertThat(result.provider()).isEqualTo(MemberProvider.KAKAO);
    }

    @Test
    void Naver_속성_파싱_성공() {
        Map<String, Object> response = Map.of(
                "id", "naver-id-456",
                "email", "user@naver.com",
                "name", "홍길동",
                "nickname", "길동이"
        );
        Map<String, Object> attributes = Map.of("response", response);

        OAuthAttributes result = OAuthAttributes.of("naver", attributes);

        assertThat(result.providerId()).isEqualTo("naver-id-456");
        assertThat(result.email()).isEqualTo("user@naver.com");
        assertThat(result.name()).isEqualTo("홍길동");
        assertThat(result.nickname()).isEqualTo("길동이");
        assertThat(result.provider()).isEqualTo(MemberProvider.NAVER);
    }

    @Test
    void Naver_닉네임_없으면_이름으로_대체() {
        Map<String, Object> response = Map.of(
                "id", "naver-id-789",
                "email", "user@naver.com",
                "name", "홍길동"
        );
        Map<String, Object> attributes = Map.of("response", response);

        OAuthAttributes result = OAuthAttributes.of("naver", attributes);

        assertThat(result.nickname()).isEqualTo("홍길동");
    }

    @Test
    void 지원하지_않는_provider_예외() {
        assertThatThrownBy(() -> OAuthAttributes.of("twitter", Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("twitter");
    }
}
