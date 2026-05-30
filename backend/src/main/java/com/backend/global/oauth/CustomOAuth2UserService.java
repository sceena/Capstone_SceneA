package com.backend.global.oauth;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final MemberRepository memberRepository;

    protected OAuth2User fetchFromProvider(OAuth2UserRequest userRequest) {
        return super.loadUser(userRequest);
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = fetchFromProvider(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        OAuthAttributes attrs = OAuthAttributes.of(registrationId, oAuth2User.getAttributes());

        Member member = findOrCreate(attrs);
        return new CustomOAuth2User(member.getId(), member.getRole().name(), oAuth2User.getAttributes());
    }

    private Member findOrCreate(OAuthAttributes attrs) {
        return memberRepository.findByProviderAndProviderId(attrs.provider(), attrs.providerId())
                .orElseGet(() -> createMember(attrs));
    }

    private Member createMember(OAuthAttributes attrs) {
        if (attrs.email() != null && memberRepository.existsByEmail(attrs.email())) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("email_conflict",
                            "해당 이메일은 이미 일반 로그인으로 가입되어 있습니다.", null));
        }

        Role role = extractRoleFromCookie();
        Member member = Member.builder()
                .email(attrs.email())
                .name(attrs.name())
                .nickname(attrs.nickname() != null ? attrs.nickname() : attrs.name())
                .provider(attrs.provider())
                .providerId(attrs.providerId())
                .role(role)
                .build();
        return memberRepository.save(member);
    }

    private Role extractRoleFromCookie() {
        try {
            HttpServletRequest request = ((ServletRequestAttributes)
                    RequestContextHolder.currentRequestAttributes()).getRequest();
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("oauth_role".equals(cookie.getName())) {
                        return Role.valueOf(cookie.getValue().toUpperCase());
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return Role.MENTEE;
    }
}
