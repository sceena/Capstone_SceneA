package com.backend.domain.mentorAvailability.controller;

import com.backend.domain.mentorAvailability.dto.request.AvailabilityCreateRequest;
import com.backend.domain.mentorAvailability.dto.response.AvailabilityResponse;
import com.backend.domain.mentorAvailability.service.MentorAvailabilityService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class MentorAvailabilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private MentorAvailabilityService availabilityService;

    @Test
    void 가용시간_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        List<AvailabilityResponse> response = List.of(
                new AvailabilityResponse(10L, 2L, start, end, false),
                new AvailabilityResponse(11L, 2L, start.plusDays(1), end.plusDays(1), false)
        );

        given(availabilityService.getAvailabilities(eq(2L))).willReturn(response);

        mockMvc.perform(get("/api/availability/mentors/2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].is_booked").value(false))
                .andExpect(jsonPath("$[1].id").value(11));
    }

    @Test
    void 가용시간_조회_결과없으면_빈배열_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        given(availabilityService.getAvailabilities(eq(2L))).willReturn(List.of());

        mockMvc.perform(get("/api/availability/mentors/2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void 가용시간_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/availability/mentors/2"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 가용시간_삭제_성공_204() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        mockMvc.perform(delete("/api/availability/10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void 가용시간_삭제_본인슬롯아님_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTOR");

        willThrow(new CustomException(ErrorCode.ACCESS_DENIED))
                .given(availabilityService).delete(eq(99L), eq(10L));

        mockMvc.perform(delete("/api/availability/10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 가용시간_삭제_이미예약된슬롯_409() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        willThrow(new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN))
                .given(availabilityService).delete(eq(1L), eq(10L));

        mockMvc.perform(delete("/api/availability/10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    void 가용시간_삭제_슬롯없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        willThrow(new CustomException(ErrorCode.AVAILABILITY_NOT_FOUND))
                .given(availabilityService).delete(eq(1L), eq(999L));

        mockMvc.perform(delete("/api/availability/999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void 가용시간_삭제_인증없이_401() throws Exception {
        mockMvc.perform(delete("/api/availability/10"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 가용시간_등록_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        AvailabilityCreateRequest request = new AvailabilityCreateRequest(start, end);
        AvailabilityResponse response = new AvailabilityResponse(10L, 1L, start, end, false);

        given(availabilityService.create(any(), any())).willReturn(response);

        mockMvc.perform(post("/api/availability")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.mentor_id").value(1))
                .andExpect(jsonPath("$.is_booked").value(false));
    }

    @Test
    void 가용시간_등록_멘토아님_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        AvailabilityCreateRequest request = new AvailabilityCreateRequest(start, end);

        given(availabilityService.create(any(), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/availability")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 가용시간_등록_인증없이_401() throws Exception {
        AvailabilityCreateRequest request = new AvailabilityCreateRequest(
                LocalDateTime.of(2026, 6, 1, 19, 0),
                LocalDateTime.of(2026, 6, 1, 20, 0)
        );

        mockMvc.perform(post("/api/availability")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 가용시간_등록_회원없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(999L, "MENTOR");
        AvailabilityCreateRequest request = new AvailabilityCreateRequest(
                LocalDateTime.of(2026, 6, 1, 19, 0),
                LocalDateTime.of(2026, 6, 1, 20, 0)
        );

        given(availabilityService.create(any(), any()))
                .willThrow(new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        mockMvc.perform(post("/api/availability")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }
}
