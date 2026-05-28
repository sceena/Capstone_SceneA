package com.backend.domain.member.controller;

import com.backend.domain.member.dto.request.LoginRequest;
import com.backend.domain.member.dto.request.SignupRequest;
import com.backend.domain.member.dto.response.LoginResponse;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.service.AuthService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Set;

@Tag(name = "인증", description = "회원가입 / 로그인 / 로그아웃 / 회원탈퇴")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "회원가입")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "회원가입 성공"),
            @ApiResponse(responseCode = "400", description = "잘못된 요청")
    })
    @PostMapping("/signup")
    public ResponseEntity<Void> signup(@RequestBody SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "로그인", description = "이메일/비밀번호로 로그인 후 JWT 토큰 반환")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "로그인 성공"),
            @ApiResponse(responseCode = "401", description = "이메일 또는 비밀번호 불일치")
    })
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(
            summary = "소셜 로그인 시작",
            description = "소셜 로그인을 시작합니다. role 파라미터로 가입 역할을 지정하세요 (기존 회원은 무시됩니다). " +
                    "성공 시 {redirect-uri}?access_token=...&refresh_token=..., " +
                    "실패 시 {redirect-uri}?error=... 로 리다이렉트됩니다."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "302", description = "OAuth 제공자로 리다이렉트"),
            @ApiResponse(responseCode = "400", description = "지원하지 않는 provider 또는 role")
    })
    @GetMapping("/oauth2/{provider}")
    public ResponseEntity<Void> oauth2Authorize(
            @Parameter(description = "소셜 제공자 (google, kakao, naver)", example = "google")
            @PathVariable String provider,
            @Parameter(description = "가입 역할 (신규 가입자에만 적용)", example = "MENTEE")
            @RequestParam(defaultValue = "MENTEE") String role) {

        Set<String> supportedProviders = Set.of("google", "kakao", "naver");
        if (!supportedProviders.contains(provider.toLowerCase())) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }
        try {
            Role.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        ResponseCookie roleCookie = ResponseCookie.from("oauth_role", role.toUpperCase())
                .httpOnly(true)
                .path("/")
                .maxAge(300)
                .sameSite("Lax")
                .build();

        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.SET_COOKIE, roleCookie.toString())
                .location(URI.create("/oauth2/authorization/" + provider.toLowerCase()))
                .build();
    }

    @Operation(summary = "로그아웃")
    @ApiResponse(responseCode = "200", description = "로그아웃 성공")
    @SecurityRequirement(name = "bearer-key")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "회원탈퇴", description = "본인 계정 소프트 삭제")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "탈퇴 성공"),
            @ApiResponse(responseCode = "401", description = "인증 필요")
    })
    @SecurityRequirement(name = "bearer-key")
    @DeleteMapping("/withdraw")
    public ResponseEntity<Void> withdraw(@AuthenticationPrincipal Long memberId) {
        authService.withdraw(memberId);
        return ResponseEntity.ok().build();
    }
}
