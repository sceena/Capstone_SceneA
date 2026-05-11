package com.backend.domain.member.controller;

import com.backend.domain.member.dto.request.UserProfileUpdateRequest;
import com.backend.domain.member.dto.response.MySessionHistoryResponse;
import com.backend.domain.member.dto.response.UserProfileResponse;
import com.backend.domain.member.dto.response.UserProfileUpdateResponse;
import com.backend.domain.member.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "마이페이지", description = "내 프로필 조회 / 수정 / 면접 내역 조회")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class UserController {

    private final UserService userService;

    @Operation(summary = "내 프로필 조회", description = "로그인한 사용자의 프로필 정보를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal Long memberId) {
        return ResponseEntity.ok(userService.getMyProfile(memberId));
    }

    @Operation(summary = "내 프로필 수정", description = "로그인한 사용자의 이름, 비밀번호를 수정한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 성공"),
            @ApiResponse(responseCode = "400", description = "수정할 필드 없음"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @PatchMapping("/me")
    public ResponseEntity<UserProfileUpdateResponse> updateMyProfile(
            @AuthenticationPrincipal Long memberId,
            @RequestBody UserProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateMyProfile(memberId, request));
    }

    @Operation(summary = "내 면접 내역 조회", description = "마이페이지에서 본인이 참여한 면접 세션 목록과 리포트 상태를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @GetMapping("/me/sessions")
    public ResponseEntity<MySessionHistoryResponse> getMySessionHistory(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(userService.getMySessionHistory(memberId, PageRequest.of(page, size)));
    }
}
