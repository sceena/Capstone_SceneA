package com.backend.domain.interviewSession.controller;

import com.backend.domain.interviewSession.dto.request.ParticipantStatusRequest;
import com.backend.domain.interviewSession.dto.request.SessionCreateRequest;
import com.backend.domain.interviewSession.dto.request.SessionStatusRequest;
import com.backend.domain.interviewSession.dto.response.*;
import com.backend.domain.interviewSession.dto.response.ParticipantStatusResponse;
import com.backend.domain.interviewSession.service.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "세션", description = "세션 생성 / 조회 / 상태 변경 / 참여")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class SessionController {

    private final SessionService sessionService;

    @Operation(summary = "세션 생성", description = "멘토가 새 면접 세션을 생성한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "세션 생성 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "404", description = "멘토 없음")
    })
    @PostMapping
    public ResponseEntity<SessionCreateResponse> createSession(
            @AuthenticationPrincipal Long mentorId,
            @RequestBody SessionCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.createSession(mentorId, request));
    }

    @Operation(summary = "세션 단건 조회", description = "특정 세션의 상세 정보를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "403", description = "해당 세션에 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @GetMapping("/{id}")
    public ResponseEntity<SessionDetailResponse> getSession(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(sessionService.getSession(memberId, id));
    }

    @Operation(summary = "내 세션 목록 조회", description = "로그인한 사용자가 참여한 세션 목록을 조회한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping("/me")
    public ResponseEntity<SessionListResponse> getMySessions(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(sessionService.getMySessions(memberId, status, PageRequest.of(page, size)));
    }

    @Operation(summary = "세션 상태 변경", description = "세션 상태를 변경한다. scheduled→in_progress→completed 순서만 허용.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "상태 변경 성공"),
            @ApiResponse(responseCode = "400", description = "유효하지 않은 상태 전환"),
            @ApiResponse(responseCode = "403", description = "권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @PatchMapping("/{id}/status")
    public ResponseEntity<SessionStatusResponse> updateSessionStatus(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @RequestBody SessionStatusRequest request) {
        return ResponseEntity.ok(sessionService.updateSessionStatus(mentorId, id, request));
    }

    @Operation(summary = "참여자 answer_status 변경", description = "멘티의 답변 상태를 변경한다. 본인만 변경 가능.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "상태 변경 성공"),
            @ApiResponse(responseCode = "403", description = "본인 외 변경 시도"),
            @ApiResponse(responseCode = "404", description = "세션 또는 참여자 없음")
    })
    @PatchMapping("/{id}/participants/{userId}/status")
    public ResponseEntity<ParticipantStatusResponse> updateParticipantStatus(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody ParticipantStatusRequest request) {
        return ResponseEntity.ok(sessionService.updateParticipantStatus(memberId, id, userId, request));
    }

    @Operation(summary = "세션 참여자 입장", description = "멘티 또는 멘토가 세션에 참여한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "참여 성공"),
            @ApiResponse(responseCode = "400", description = "이미 참여한 사용자"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @PostMapping("/{id}/join")
    public ResponseEntity<SessionJoinResponse> joinSession(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.joinSession(memberId, id));
    }
}
