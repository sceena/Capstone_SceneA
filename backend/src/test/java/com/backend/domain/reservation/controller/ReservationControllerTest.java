package com.backend.domain.reservation.controller;

import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.dto.response.ReservationAcceptResponse;
import com.backend.domain.reservation.dto.response.ReservationResponse;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.service.ReservationService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ReservationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private ReservationService reservationService;

    @Test
    void 예약_신청_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        ReservationRequest request = new ReservationRequest(3L, 7L, 12L);
        ReservationResponse response = new ReservationResponse(55L, 3L, 7L, ReservationStatus.PENDING, LocalDateTime.now());

        given(reservationService.createReservation(any(), any())).willReturn(response);

        mockMvc.perform(post("/api/reservation/request")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.mentor_id").value(3))
                .andExpect(jsonPath("$.availability_id").value(7))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void 예약_신청_인증없이_401() throws Exception {
        ReservationRequest request = new ReservationRequest(3L, 7L, 12L);

        mockMvc.perform(post("/api/reservation/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 예약_신청_이미예약된슬롯_409() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        ReservationRequest request = new ReservationRequest(3L, 7L, 12L);

        given(reservationService.createReservation(any(), any()))
                .willThrow(new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN));

        mockMvc.perform(post("/api/reservation/request")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    void 예약_수락_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTOR");
        ReservationAcceptRequest request = new ReservationAcceptRequest(true);
        ReservationAcceptResponse response = new ReservationAcceptResponse(55L, ReservationStatus.CONFIRMED, LocalDateTime.now());

        given(reservationService.acceptReservation(any(), eq(55L), any())).willReturn(response);

        mockMvc.perform(post("/api/reservation/55/response")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    void 예약_수락_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTOR");
        ReservationAcceptRequest request = new ReservationAcceptRequest(true);

        given(reservationService.acceptReservation(any(), eq(55L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/reservation/55/response")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 예약_수락_인증없이_401() throws Exception {
        ReservationAcceptRequest request = new ReservationAcceptRequest(true);

        mockMvc.perform(post("/api/reservation/55/response")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
