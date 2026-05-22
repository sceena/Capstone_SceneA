package com.backend.domain.videoCall.controller;

import com.backend.domain.videoCall.dto.response.VideoTokenResponse;
import com.backend.domain.videoCall.service.VideoCallService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "화상통화", description = "LiveKit 화상통화 토큰 발급")
@RestController
@RequestMapping("/api/video")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class VideoCallController {

    private final VideoCallService videoCallService;

    @Operation(
            summary = "화상통화 토큰 발급",
            description = "세션 입장용 LiveKit JWT 토큰을 발급한다. 멘토 또는 해당 세션 참여자(멘티)만 가능."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "토큰 발급 성공"),
            @ApiResponse(responseCode = "400", description = "종료된 세션"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 또는 회원 없음")
    })
    @PostMapping("/{sessionId}/token")
    public ResponseEntity<VideoTokenResponse> getToken(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long sessionId) {
        return ResponseEntity.ok(videoCallService.getToken(memberId, sessionId));
    }
}
