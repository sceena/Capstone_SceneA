package com.backend.domain.reservation.controller;

import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.dto.response.ReservationAcceptResponse;
import com.backend.domain.reservation.dto.response.ReservationResponse;
import com.backend.domain.reservation.dto.response.ReservationSummaryResponse;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.service.ReservationService;
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

@Tag(name = "예약", description = "예약 신청 / 수락·거절")
@RestController
@RequestMapping("/api/reservation")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class ReservationController {

    private final ReservationService reservationService;

    @GetMapping("/mentor")
    public ResponseEntity<List<ReservationSummaryResponse>> getMentorReservations(
            @AuthenticationPrincipal Long mentorId,
            @RequestParam(required = false) ReservationStatus status) {
        return ResponseEntity.ok(reservationService.getMentorReservations(mentorId, status));
    }

    @Operation(summary = "예약 신청", description = "멘티가 멘토 가용 시간 슬롯에 예약 신청 (status: PENDING)")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "예약 신청 성공"),
            @ApiResponse(responseCode = "404", description = "멘토 또는 가용 시간 슬롯 없음"),
            @ApiResponse(responseCode = "409", description = "이미 예약된 슬롯")
    })
    @PostMapping("/request")
    public ResponseEntity<ReservationResponse> createReservation(
            @AuthenticationPrincipal Long menteeId,
            @RequestBody ReservationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reservationService.createReservation(menteeId, request));
    }

    @Operation(summary = "예약 수락/거절", description = "멘토가 예약을 수락(true)하면 세션 자동 생성, 거절(false)하면 슬롯 반환")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수락/거절 처리 성공"),
            @ApiResponse(responseCode = "403", description = "해당 예약의 담당 멘토 아님"),
            @ApiResponse(responseCode = "404", description = "예약 신청 없음")
    })
    @PostMapping("/{id}/response")
    public ResponseEntity<ReservationAcceptResponse> acceptReservation(
            @AuthenticationPrincipal Long mentorId,
            @PathVariable Long id,
            @RequestBody ReservationAcceptRequest request) {
        return ResponseEntity.ok(reservationService.acceptReservation(mentorId, id, request));
    }
}
