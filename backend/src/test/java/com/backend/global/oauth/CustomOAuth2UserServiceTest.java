package com.backend.global.oauth;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.MemberProvider;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomOAuth2UserServiceTest {

    @Mock
    private MemberRepository memberRepository;

    private CustomOAuth2UserService service;

    @BeforeEach
    void setUp() {
        service = spy(new CustomOAuth2UserService(memberRepository));
    }

    @Test
    void 기존_소셜_회원_로그인_성공() {
        Map<String, Object> attrs = Map.of("id", "g-123", "email", "user@gmail.com", "name", "홍길동");
        OAuth2User mockUser = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("ROLE_USER")), attrs, "id");
        OAuth2UserRequest userRequest = buildUserRequest("google");

        Member existingMember = Member.builder()
                .email("user@gmail.com").name("홍길동").nickname("홍길동")
                .provider(MemberProvider.GOOGLE).providerId("g-123").role(Role.MENTEE)
                .build();

        doReturn(mockUser).when(service).fetchFromProvider(userRequest);
        given(memberRepository.findByProviderAndProviderId(MemberProvider.GOOGLE, "g-123"))
                .willReturn(Optional.of(existingMember));

        OAuth2User result = service.loadUser(userRequest);

        assertThat(result).isInstanceOf(CustomOAuth2User.class);
        verify(memberRepository, never()).save(any());
    }

    @Test
    void 신규_소셜_회원_가입_성공() {
        Map<String, Object> attrs = Map.of("id", "g-456", "email", "new@gmail.com", "name", "새회원");
        OAuth2User mockUser = new DefaultOAuth2User(List.of(), attrs, "id");
        OAuth2UserRequest userRequest = buildUserRequest("google");

        Member savedMember = Member.builder()
                .email("new@gmail.com").name("새회원").nickname("새회원")
                .provider(MemberProvider.GOOGLE).providerId("g-456").role(Role.MENTEE)
                .build();

        doReturn(mockUser).when(service).fetchFromProvider(userRequest);
        given(memberRepository.findByProviderAndProviderId(MemberProvider.GOOGLE, "g-456"))
                .willReturn(Optional.empty());
        given(memberRepository.existsByEmail("new@gmail.com")).willReturn(false);
        given(memberRepository.save(any(Member.class))).willReturn(savedMember);

        OAuth2User result = service.loadUser(userRequest);

        assertThat(result).isInstanceOf(CustomOAuth2User.class);
        verify(memberRepository).save(any(Member.class));
    }

    @Test
    void 일반_로그인_이메일로_소셜_로그인_시도시_충돌_예외() {
        Map<String, Object> attrs = Map.of("id", "g-789", "email", "existing@gmail.com", "name", "기존회원");
        OAuth2User mockUser = new DefaultOAuth2User(List.of(), attrs, "id");
        OAuth2UserRequest userRequest = buildUserRequest("google");

        doReturn(mockUser).when(service).fetchFromProvider(userRequest);
        given(memberRepository.findByProviderAndProviderId(MemberProvider.GOOGLE, "g-789"))
                .willReturn(Optional.empty());
        given(memberRepository.existsByEmail("existing@gmail.com")).willReturn(true);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(e -> assertThat(((OAuth2AuthenticationException) e).getError().getErrorCode())
                        .isEqualTo("email_conflict"));
    }

    private OAuth2UserRequest buildUserRequest(String registrationId) {
        ClientRegistration registration = ClientRegistration.withRegistrationId(registrationId)
                .clientId("client-id")
                .clientSecret("client-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .authorizationUri("https://example.com/auth")
                .tokenUri("https://example.com/token")
                .userInfoUri("https://example.com/userinfo")
                .userNameAttributeName("id")
                .build();

        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER, "token", Instant.now(), Instant.now().plusSeconds(3600));

        return new OAuth2UserRequest(registration, accessToken);
    }
}
