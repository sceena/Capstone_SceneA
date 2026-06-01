package com.backend.domain.interviewAnswer.controller;

import com.backend.domain.interviewAnswer.dto.request.MentorScoreRequest;
import com.backend.domain.interviewAnswer.dto.response.AnswerAudioResponse;
import com.backend.domain.interviewAnswer.dto.response.AnswerDetailResponse;
import com.backend.domain.interviewAnswer.dto.response.AnswerUploadResponse;
import com.backend.domain.interviewAnswer.dto.response.MentorScoreResponse;
import com.backend.domain.interviewAnswer.service.AnswerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "면접 답변", description = "답변 업로드 / 조회 / 별점 입력")
@RestController
@RequestMapping("/api/sessions/{id}/questions/{questionId}/answers")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class AnswerController {

    private final AnswerService answerService;

    @Operation(summary = "답변 오디오 업로드", description = "멘티의 답변 오디오를 업로드하고 저장한다. 업로드 후 STT 및 AI 분석이 비동기로 진행됨.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "답변 저장 성공"),
            @ApiResponse(responseCode = "400", description = "필수 필드 누락 또는 파일 형식 오류"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 멘티 아님"),
            @ApiResponse(responseCode = "404", description = "세션 또는 질문 없음")
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnswerUploadResponse> uploadAnswer(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @RequestPart("audio") MultipartFile audio,
            @RequestParam("answer_start") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime answerStart,
            @RequestParam("answer_end") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime answerEnd,
            @RequestParam("mentee_id") Long menteeId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(answerService.uploadAnswer(memberId, id, questionId, audio, answerStart, answerEnd, menteeId));
    }

    @Operation(summary = "질문별 답변 목록 조회", description = "특정 질문의 모든 멘티 답변을 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "세션 또는 질문 없음")
    })
    @GetMapping
    public ResponseEntity<List<AnswerDetailResponse>> getAnswers(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId) {
        return ResponseEntity.ok(answerService.getAnswers(memberId, id, questionId));
    }

    @Operation(summary = "답변 오디오 다시 듣기", description = "저장된 답변 오디오 파일을 스트리밍으로 반환한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "오디오 반환 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "답변 없음")
    })
    @GetMapping("/{answerId}/audio")
    public ResponseEntity<org.springframework.core.io.Resource> getAudio(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @PathVariable Long answerId) {
        AnswerAudioResponse audio = answerService.getAudio(memberId, id, questionId, answerId);
        return ResponseEntity.ok()
                .contentType(audio.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + audio.filename() + "\"")
                .body(audio.resource());
    }

    @Operation(summary = "멘토 별점 입력", description = "멘토가 답변에 별점을 입력한다. gap이 자동 계산됨.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "멘토 별점 입력 성공"),
            @ApiResponse(responseCode = "400", description = "유효하지 않은 별점 값"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "멘토 외 입력 시도"),
            @ApiResponse(responseCode = "404", description = "답변 없음")
    })
    @PatchMapping("/{answerId}/mentor-score")
    public ResponseEntity<MentorScoreResponse> updateMentorScore(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @PathVariable Long questionId,
            @PathVariable Long answerId,
            @RequestBody MentorScoreRequest request) {
        return ResponseEntity.ok(answerService.updateMentorScore(mentorId, id, questionId, answerId, request));
    }
}
