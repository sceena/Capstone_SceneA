package com.backend.domain.analysisReport.controller;

import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.analysisReport.dto.response.FitGapResponse;
import com.backend.domain.analysisReport.dto.response.MentorFeedbackResponse;
import com.backend.domain.analysisReport.dto.response.ReportResponse;
import com.backend.domain.analysisReport.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "리포트", description = "리포트 조회 / 피드백 작성")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class ReportController {

    private final ReportService reportService;

    @Operation(summary = "리포트 조회", description = "세션의 리포트를 조회한다. report_status가 first이면 1차 AI 리포트, final이면 최종 리포트.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "리포트 없음")
    })
    @GetMapping("/{id}/report")
    public ResponseEntity<ReportResponse> getReport(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @RequestParam(required = false) Long menteeId) {
        // menteeId 없으면 기존 2파라미터 메서드 호출 → 기존 테스트 영향 없음
        return ResponseEntity.ok(
            menteeId != null
                ? reportService.getReportForMentee(memberId, id, menteeId)
                : reportService.getReport(memberId, id)
        );
    }

    @Operation(summary = "AI 리포트 생성", description = "세션의 질문/답변/자소서/채용공고 정보를 AI 서버에 보내 리포트를 생성하고 저장한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "AI 리포트 생성 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 또는 답변 없음"),
            @ApiResponse(responseCode = "502", description = "AI 서버 호출 실패")
    })
    @PostMapping("/{id}/report/generate")
    public ResponseEntity<ReportResponse> generateReport(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(reportService.generateReport(memberId, id));
    }

    @Operation(summary = "Fit-Gap 역량 분석 조회", description = "채용공고 역량 vs 자소서 역량 비교 결과를 조회한다. AI가 추출한 skill 목록 기반으로 일치/불일치 역량을 반환한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "리포트 / 채용공고 / 자소서 없음")
    })
    @GetMapping("/{id}/report/fit-gap")
    public ResponseEntity<FitGapResponse> getFitGap(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(reportService.getFitGap(memberId, id));
    }

    @Operation(summary = "멘토 종합 피드백 작성", description = "멘토가 AI 리포트를 기반으로 피드백을 작성한다. 기존 AI 리포트(first)는 보존되고 새로운 final 리포트가 생성된다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "멘토 피드백 저장 성공, final 리포트 생성"),
            @ApiResponse(responseCode = "400", description = "mentor_feedback 누락 또는 빈 문자열"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "멘토 외 입력 시도"),
            @ApiResponse(responseCode = "404", description = "AI 리포트(first) 없음")
    })
    @RequestMapping(value = "/{id}/report/mentor-feedback", method = {RequestMethod.PATCH, RequestMethod.POST})
    public ResponseEntity<MentorFeedbackResponse> addMentorFeedback(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @Valid @RequestBody MentorFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reportService.addMentorFeedback(memberId, id, request));
    }
}
