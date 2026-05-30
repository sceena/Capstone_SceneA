package com.backend.domain.answerEvaluation.controller;

import com.backend.domain.answerEvaluation.dto.request.MentorEvaluationRequest;
import com.backend.domain.answerEvaluation.dto.response.AnswerEvaluationResponse;
import com.backend.domain.answerEvaluation.service.AnswerEvaluationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "답변 평가", description = "AI 평가 초안과 멘토 수정 평가 관리")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class AnswerEvaluationController {

    private final AnswerEvaluationService answerEvaluationService;

    @Operation(summary = "멘토 질문별 평가 수정", description = "AI 평가 초안은 보존하고 멘토 수정본만 저장한다. 향후 DPO chosen 데이터로 활용된다.")
    @PatchMapping("/{sessionId}/answers/{answerId}/evaluation/mentor")
    public ResponseEntity<AnswerEvaluationResponse> updateMentorEvaluation(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long sessionId,
            @PathVariable Long answerId,
            @Valid @RequestBody MentorEvaluationRequest request
    ) {
        return ResponseEntity.ok(answerEvaluationService.updateMentorEvaluation(
                mentorId,
                sessionId,
                answerId,
                request
        ));
    }
}
