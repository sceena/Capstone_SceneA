package com.backend.domain.jobPosting.controller;

import com.backend.domain.jobPosting.dto.request.JobPostingSaveRequest;
import com.backend.domain.jobPosting.dto.response.JobPostingSaveResponse;
import com.backend.domain.jobPosting.dto.response.JobSkillsResponse;
import com.backend.domain.jobPosting.service.JobPostingService;
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

@Tag(name = "채용공고", description = "채용공고 저장 / 역량 조회")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class JobPostingController {

    private final JobPostingService jobPostingService;

    @Operation(summary = "채용공고 저장", description = "멘티가 채용공고 원문을 입력한다. 세션과 연결됨.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "채용공고 저장 성공"),
            @ApiResponse(responseCode = "400", description = "필수 필드 누락"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "멘티 외 저장 시도"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @PostMapping("/{id}/job-posting")
    public ResponseEntity<JobPostingSaveResponse> saveJobPosting(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @Valid @RequestBody JobPostingSaveRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(jobPostingService.saveJobPosting(memberId, id, request));
    }

    @Operation(summary = "채용공고 역량 조회", description = "AI가 채용공고에서 추출한 필수/우대 역량 키워드 목록을 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "채용공고 없음")
    })
    @GetMapping("/{id}/job-posting/skills")
    public ResponseEntity<JobSkillsResponse> getJobSkills(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(jobPostingService.getJobSkills(memberId, id));
    }
}
