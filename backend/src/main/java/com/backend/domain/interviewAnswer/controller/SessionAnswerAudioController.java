package com.backend.domain.interviewAnswer.controller;

import com.backend.domain.interviewAnswer.dto.response.AnswerAudioResponse;
import com.backend.domain.interviewAnswer.service.AnswerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "면접 답변", description = "답변 오디오 다시 듣기")
@RestController
@RequestMapping("/api/sessions/{id}/answers")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class SessionAnswerAudioController {

    private final AnswerService answerService;

    @Operation(summary = "답변 오디오 다시 듣기", description = "최종 리포트에서 answerId만으로 저장된 답변 오디오를 스트리밍한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "오디오 반환 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료"),
            @ApiResponse(responseCode = "403", description = "해당 세션 접근 권한 없음"),
            @ApiResponse(responseCode = "404", description = "답변 없음")
    })
    @GetMapping("/{answerId}/audio")
    public ResponseEntity<org.springframework.core.io.Resource> getAudioByAnswerId(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long id,
            @PathVariable Long answerId) {
        AnswerAudioResponse audio = answerService.getAudioByAnswerId(memberId, id, answerId);
        return ResponseEntity.ok()
                .contentType(audio.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + audio.filename() + "\"")
                .body(audio.resource());
    }
}
