package com.backend.domain.speechAnalysis.controller;

import com.backend.domain.speechAnalysis.dto.response.ScriptSegmentResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse;
import com.backend.domain.speechAnalysis.dto.response.SpeechAnalysisResponse;
import com.backend.domain.speechAnalysis.service.SpeechAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "AI 분석", description = "답변 AI 분석 결과 / 세그먼트 / 요약 조회")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class SpeechAnalysisController {

    private final SpeechAnalysisService speechAnalysisService;

    @Operation(summary = "답변 AI 분석 결과 조회",
            description = "STT 변환 텍스트 및 AI 정량 평가 결과를 조회한다. Whisper STT 및 파인튜닝 모델 분석 완료 후 조회 가능.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "답변 또는 분석 결과 없음")
    })
    @GetMapping("/{id}/questions/{questionId}/answers/{answerId}/analysis")
    public ResponseEntity<SpeechAnalysisResponse> getAnalysis(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @PathVariable Long answerId) {
        return ResponseEntity.ok(speechAnalysisService.getAnalysis(memberId, id, questionId, answerId));
    }

    @Operation(summary = "답변 스크립트 세그먼트 조회",
            description = "답변 텍스트의 논리성 하이라이트 세그먼트 목록을 조회한다. 리포트의 하이라이트 클릭 시 근거 노출에 사용.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "답변 또는 분석 결과 없음")
    })
    @GetMapping("/{id}/questions/{questionId}/answers/{answerId}/segments")
    public ResponseEntity<List<ScriptSegmentResponse>> getSegments(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @PathVariable Long answerId) {
        return ResponseEntity.ok(speechAnalysisService.getSegments(memberId, id, questionId, answerId));
    }

    @Operation(summary = "세션 AI 분석 요약 조회",
            description = "세션 전체 답변에 대한 AI 분석 요약을 조회한다. BEST/WORST 답변 식별 포함.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @GetMapping("/{id}/analysis/summary")
    public ResponseEntity<SessionAnalysisSummaryResponse> getSummary(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(speechAnalysisService.getSummary(memberId, id));
    }
}
