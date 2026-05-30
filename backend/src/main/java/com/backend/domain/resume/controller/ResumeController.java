package com.backend.domain.resume.controller;

import com.backend.domain.resume.dto.request.ResumeSaveRequest;
import com.backend.domain.resume.dto.response.ResumeSkillsResponse;
import com.backend.domain.resume.dto.response.ResumeSaveResponse;
import com.backend.domain.resume.service.ResumeService;
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

@Tag(name = "자소서", description = "자소서 저장 / 역량 조회")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class ResumeController {

    private final ResumeService resumeService;

    @Operation(summary = "자소서 저장", description = "멘티가 자소서 텍스트를 직접 입력한다. 파일 업로드 없이 텍스트로만 저장.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "자소서 저장 성공"),
            @ApiResponse(responseCode = "400", description = "content 누락 또는 빈 문자열"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "멘티 외 저장 시도"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @PostMapping("/{id}/resume")
    public ResponseEntity<ResumeSaveResponse> saveResume(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @Valid @RequestBody ResumeSaveRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(resumeService.saveResume(memberId, id, request));
    }

    @Operation(summary = "자소서 조회", description = "세션에 등록된 자소서 원문을 조회한다. 멘토가 호출하면 멘티의 자소서를 반환한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "자소서 없음")
    })
    @GetMapping("/{id}/resume")
    public ResponseEntity<ResumeSaveResponse> getResume(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(resumeService.getResume(memberId, id));
    }

    @Operation(summary = "자소서 역량 조회", description = "AI가 자소서에서 추출한 역량 키워드 목록을 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "자소서 없음")
    })
    @GetMapping("/{id}/resume/skills")
    public ResponseEntity<ResumeSkillsResponse> getResumeSkills(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(resumeService.getResumeSkills(memberId, id));
    }
}
