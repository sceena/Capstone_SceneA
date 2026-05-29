package com.backend.domain.mentorAvailability.controller;

import com.backend.domain.mentorAvailability.dto.request.AvailabilityCreateRequest;
import com.backend.domain.mentorAvailability.dto.response.AvailabilityResponse;
import com.backend.domain.mentorAvailability.service.MentorAvailabilityService;
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

@Tag(name = "멘토 가용시간", description = "멘토 가용시간 등록 / 조회 / 삭제")
@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class MentorAvailabilityController {

    private final MentorAvailabilityService availabilityService;

    @Operation(summary = "가용시간 조회", description = "특정 멘토의 예약 가능한 시간 슬롯 목록을 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "403", description = "멘토 권한 없음"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 회원")
    })
    @GetMapping("/mentors/{mentorId}")
    public ResponseEntity<List<AvailabilityResponse>> getAvailabilities(
            @PathVariable Long mentorId) {
        return ResponseEntity.ok(availabilityService.getAvailabilities(mentorId));
    }

    @Operation(summary = "가용시간 삭제", description = "멘토가 본인의 가용시간 슬롯을 삭제한다. 이미 예약된 슬롯은 삭제 불가.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "삭제 성공"),
            @ApiResponse(responseCode = "403", description = "본인 슬롯 아님"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 슬롯"),
            @ApiResponse(responseCode = "409", description = "이미 예약된 슬롯")
    })
    @DeleteMapping("/{availabilityId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long availabilityId) {
        availabilityService.delete(mentorId, availabilityId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "가용시간 등록", description = "멘토가 면접 가능한 시간 슬롯을 등록한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "등록 성공"),
            @ApiResponse(responseCode = "403", description = "멘토 권한 없음"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 회원")
    })
    @PostMapping
    public ResponseEntity<AvailabilityResponse> create(
            @AuthenticationPrincipal Long mentorId,
            @RequestBody AvailabilityCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(availabilityService.create(mentorId, request));
    }
}
