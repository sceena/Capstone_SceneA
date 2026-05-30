package com.backend.domain.interviewAnswer.controller;

import com.backend.domain.interviewAnswer.dto.response.SessionSttStatusResponse;
import com.backend.domain.interviewAnswer.service.AnswerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "면접 답변", description = "답변 업로드 / 조회 / 별점 입력")
@RestController
@RequestMapping("/api/sessions/{id}/answers")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class SessionAnswerController {

    private final AnswerService answerService;

    @Operation(summary = "세션 답변 STT 상태 조회", description = "리포트 생성 전 세션 내 답변의 STT 완료 여부를 확인한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @GetMapping("/stt-status")
    public ResponseEntity<SessionSttStatusResponse> getSessionSttStatus(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(answerService.getSessionSttStatus(memberId, id));
    }
}
