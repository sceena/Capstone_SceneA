package com.backend.domain.member.service;

import com.backend.domain.member.dto.request.LoginRequest;
import com.backend.domain.member.dto.request.SignupRequest;
import com.backend.domain.member.dto.response.LoginResponse;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.tag.dto.TagRequest;
import com.backend.domain.tag.entity.Tag;
import com.backend.domain.tag.repository.MemberTagRepository;
import com.backend.domain.tag.repository.TagRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @InjectMocks
    private AuthService authService;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private TagRepository tagRepository;

    @Mock
    private MemberTagRepository memberTagRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    @Test
    void 회원가입_성공_태그없음() {
        SignupRequest request = new SignupRequest("test@test.com", "password", "홍길동", "길동이", Role.MENTEE, null);
        given(memberRepository.existsByEmail(request.email())).willReturn(false);
        given(passwordEncoder.encode(request.password())).willReturn("encoded");

        authService.signup(request);

        verify(memberRepository).save(any(Member.class));
        verify(memberTagRepository, never()).save(any());
    }

    @Test
    void 회원가입_성공_태그있음_기존태그재사용() {
        Tag existingTag = Tag.builder().name("Java").category("기술스택").build();
        SignupRequest request = new SignupRequest("test@test.com", "password", "홍길동", "길동이", Role.MENTEE,
                List.of(new TagRequest("Java", "기술스택")));
        given(memberRepository.existsByEmail(request.email())).willReturn(false);
        given(passwordEncoder.encode(request.password())).willReturn("encoded");
        given(tagRepository.findByNameAndCategory("Java", "기술스택")).willReturn(Optional.of(existingTag));

        authService.signup(request);

        verify(memberRepository).save(any(Member.class));
        verify(tagRepository, never()).save(any());
        verify(memberTagRepository).save(any());
    }

    @Test
    void 회원가입_성공_태그있음_신규태그생성() {
        Tag newTag = Tag.builder().name("Spring").category("기술스택").build();
        SignupRequest request = new SignupRequest("test@test.com", "password", "홍길동", "길동이", Role.MENTEE,
                List.of(new TagRequest("Spring", "기술스택")));
        given(memberRepository.existsByEmail(request.email())).willReturn(false);
        given(passwordEncoder.encode(request.password())).willReturn("encoded");
        given(tagRepository.findByNameAndCategory("Spring", "기술스택")).willReturn(Optional.empty());
        given(tagRepository.save(any(Tag.class))).willReturn(newTag);

        authService.signup(request);

        verify(memberRepository).save(any(Member.class));
        verify(tagRepository).save(any(Tag.class));
        verify(memberTagRepository).save(any());
    }

    @Test
    void 회원가입_이메일_중복_예외() {
        SignupRequest request = new SignupRequest("dup@test.com", "password", "홍길동", "길동이", Role.MENTEE, null);
        given(memberRepository.existsByEmail(request.email())).willReturn(true);

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.DUPLICATE_EMAIL));
    }

    @Test
    void 로그인_성공() {
        Member member = Member.builder()
                .email("test@test.com")
                .password("encoded")
                .name("홍길동")
                .nickname("길동이")
                .role(Role.MENTEE)
                .build();
        LoginRequest request = new LoginRequest("test@test.com", "password");

        given(memberRepository.findByEmail(request.email())).willReturn(Optional.of(member));
        given(passwordEncoder.matches(request.password(), member.getPassword())).willReturn(true);
        given(jwtProvider.generateAccessToken(any(), any())).willReturn("access-token");
        given(jwtProvider.generateRefreshToken(any(), any())).willReturn("refresh-token");

        LoginResponse response = authService.login(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
    }

    @Test
    void 로그인_존재하지_않는_이메일_예외() {
        LoginRequest request = new LoginRequest("none@test.com", "password");
        given(memberRepository.findByEmail(request.email())).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS));
    }

    @Test
    void 로그인_비밀번호_불일치_예외() {
        Member member = Member.builder()
                .email("test@test.com")
                .password("encoded")
                .name("홍길동")
                .nickname("길동이")
                .role(Role.MENTEE)
                .build();
        LoginRequest request = new LoginRequest("test@test.com", "wrong");

        given(memberRepository.findByEmail(request.email())).willReturn(Optional.of(member));
        given(passwordEncoder.matches(request.password(), member.getPassword())).willReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS));
    }

    @Test
    void 로그인_탈퇴한_회원_예외() {
        Member member = Member.builder()
                .email("test@test.com")
                .password("encoded")
                .name("홍길동")
                .nickname("길동이")
                .role(Role.MENTEE)
                .build();
        member.softDelete();
        LoginRequest request = new LoginRequest("test@test.com", "password");

        given(memberRepository.findByEmail(request.email())).willReturn(Optional.of(member));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.WITHDRAWN_MEMBER));
    }

    @Test
    void 회원탈퇴_성공() {
        Member member = Member.builder()
                .email("test@test.com")
                .password("encoded")
                .name("홍길동")
                .nickname("길동이")
                .role(Role.MENTEE)
                .build();
        given(memberRepository.findById(1L)).willReturn(Optional.of(member));

        authService.withdraw(1L);

        assertThat(member.isDeleted()).isTrue();
    }

    @Test
    void 회원탈퇴_존재하지_않는_회원_예외() {
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.withdraw(999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }
}
