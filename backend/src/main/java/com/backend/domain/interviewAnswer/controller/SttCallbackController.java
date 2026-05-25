package com.backend.domain.interviewAnswer.controller;

import com.backend.domain.interviewAnswer.dto.request.SttCallbackRequest;
import com.backend.domain.interviewAnswer.service.SttCallbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class SttCallbackController {

    private final SttCallbackService sttCallbackService;

    @PostMapping("/stt/callback")
    public ResponseEntity<Void> handleSttCallback(@RequestBody SttCallbackRequest request) {
        sttCallbackService.handleCallback(request);
        return ResponseEntity.ok().build();
    }
}
