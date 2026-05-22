package com.backend.domain.dev.controller;

import com.backend.domain.dev.dto.DevReportDemoResponse;
import com.backend.domain.dev.service.DevReportDemoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "개발용 데모", description = "로컬 연동 확인용 데이터 생성 API")
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevReportDemoController {

    private final DevReportDemoService devReportDemoService;

    @Operation(summary = "AI 리포트 데모 데이터 생성", description = "세션/질문/답변/자소서/채용공고 mock 데이터를 생성하고 테스트용 JWT를 반환한다.")
    @PostMapping("/report-demo")
    public ResponseEntity<DevReportDemoResponse> createReportDemo() {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(devReportDemoService.createReportDemo());
    }
}
