package com.backend.domain.interviewQuestion.controller;

import com.backend.domain.interviewQuestion.dto.request.QuestionCreateRequest;
import com.backend.domain.interviewQuestion.dto.request.QuestionUpdateRequest;
import com.backend.domain.interviewQuestion.dto.response.QuestionCreateResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionDetailResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionUpdateResponse;
import com.backend.domain.interviewQuestion.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "면접 질문", description = "질문 생성 / 조회 / 수정 / 삭제")
@RestController
@RequestMapping("/api/sessions/{id}/questions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class QuestionController {

    private final QuestionService questionService;

    @Operation(summary = "면접 질문 생성", description = "AI가 생성한 질문을 세션에 저장한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "질문 생성 성공"),
            @ApiResponse(responseCode = "400", description = "필수 필드 누락 또는 빈 배열"),
            @ApiResponse(responseCode = "403", description = "권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @PostMapping
    public ResponseEntity<List<QuestionCreateResponse>> createQuestions(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @RequestBody QuestionCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(questionService.createQuestions(mentorId, id, request));
    }

    @Operation(summary = "세션 질문 목록 조회", description = "특정 세션의 전체 질문 목록을 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 없음")
    })
    @GetMapping
    public ResponseEntity<List<QuestionDetailResponse>> getQuestions(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.ok(questionService.getQuestions(memberId, id));
    }

    @Operation(summary = "면접 질문 단건 조회", description = "특정 질문 하나를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 또는 질문 없음")
    })
    @GetMapping("/{questionId}")
    public ResponseEntity<QuestionDetailResponse> getQuestion(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId) {
        return ResponseEntity.ok(questionService.getQuestion(memberId, id, questionId));
    }

    @Operation(summary = "면접 질문 수정", description = "멘토가 AI 생성 질문을 수정한다. 면접 시작 전(scheduled)만 허용.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 성공"),
            @ApiResponse(responseCode = "400", description = "content 누락 또는 빈 문자열"),
            @ApiResponse(responseCode = "403", description = "멘토 외 수정 시도 또는 면접 시작 후 수정 시도"),
            @ApiResponse(responseCode = "404", description = "세션 또는 질문 없음")
    })
    @PatchMapping("/{questionId}")
    public ResponseEntity<QuestionUpdateResponse> updateQuestion(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @RequestBody QuestionUpdateRequest request) {
        return ResponseEntity.ok(questionService.updateQuestion(mentorId, id, questionId, request));
    }

    @Operation(summary = "면접 질문 삭제", description = "멘토가 AI 생성 질문을 삭제한다. 면접 시작 전(scheduled)만 허용.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "삭제 성공"),
            @ApiResponse(responseCode = "403", description = "멘토 외 삭제 시도 또는 면접 시작 후 삭제 시도"),
            @ApiResponse(responseCode = "404", description = "세션 또는 질문 없음")
    })
    @DeleteMapping("/{questionId}")
    public ResponseEntity<Void> deleteQuestion(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @PathVariable Long questionId) {
        questionService.deleteQuestion(mentorId, id, questionId);
        return ResponseEntity.noContent().build();
    }
}
