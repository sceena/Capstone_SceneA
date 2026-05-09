package com.backend.domain.interviewSession.controller;

import com.backend.domain.interviewSession.dto.request.ParticipantStatusRequest;
import com.backend.domain.interviewSession.dto.request.SessionCreateRequest;
import com.backend.domain.interviewSession.dto.request.SessionStatusRequest;
import com.backend.domain.interviewSession.dto.response.*;
import com.backend.domain.interviewSession.dto.response.ParticipantStatusResponse;
import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.interviewSession.service.SessionService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private SessionService sessionService;

    @Test
    void 세션_생성_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionCreateRequest request = new SessionCreateRequest(12L, 7L, "백엔드 개발", 1L);
        SessionCreateResponse response = new SessionCreateResponse(42L, "백엔드 개발", SessionStatus.SCHEDULED, 1L, LocalDateTime.now());

        given(sessionService.createSession(any(), any())).willReturn(response);

        mockMvc.perform(post("/api/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.job_category").value("백엔드 개발"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    void 세션_생성_인증없이_401() throws Exception {
        SessionCreateRequest request = new SessionCreateRequest(12L, 7L, "백엔드 개발", 1L);

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 세션_단건조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        ParticipantInfo participant = new ParticipantInfo(10L, "mentee", AnswerStatus.WAITING, LocalDateTime.now());
        SessionDetailResponse response = new SessionDetailResponse(
                42L, "백엔드 개발", SessionStatus.SCHEDULED,
                null, null, 1L, List.of(participant),
                LocalDateTime.now(), LocalDateTime.now()
        );

        given(sessionService.getSession(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.job_category").value("백엔드 개발"))
                .andExpect(jsonPath("$.participants[0].user_id").value(10));
    }

    @Test
    void 세션_단건조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(sessionService.getSession(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 세션_단건조회_없는세션_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(sessionService.getSession(any(), eq(999L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void 내_세션_목록_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionSummaryResponse summary = new SessionSummaryResponse(42L, "백엔드 개발", SessionStatus.COMPLETED, 1L, LocalDateTime.now(), LocalDateTime.now());
        SessionListResponse response = new SessionListResponse(List.of(summary), 0, 10, 1L, 1);

        given(sessionService.getMySessions(any(), any(), any())).willReturn(response);

        mockMvc.perform(get("/api/sessions/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(42))
                .andExpect(jsonPath("$.total_elements").value(1))
                .andExpect(jsonPath("$.total_pages").value(1));
    }

    @Test
    void 내_세션_목록_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 세션_상태변경_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionStatusRequest request = new SessionStatusRequest("in_progress");
        SessionStatusResponse response = new SessionStatusResponse(42L, SessionStatus.IN_PROGRESS, LocalDateTime.now(), LocalDateTime.now());

        given(sessionService.updateSessionStatus(any(), eq(42L), any())).willReturn(response);

        mockMvc.perform(patch("/api/sessions/42/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void 세션_상태변경_역방향전환_400() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionStatusRequest request = new SessionStatusRequest("scheduled");

        given(sessionService.updateSessionStatus(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_SESSION_STATUS));

        mockMvc.perform(patch("/api/sessions/42/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 세션_상태변경_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTOR");
        SessionStatusRequest request = new SessionStatusRequest("in_progress");

        given(sessionService.updateSessionStatus(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(patch("/api/sessions/42/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 세션_참여_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        SessionJoinResponse response = new SessionJoinResponse(42L, 10L, AnswerStatus.WAITING, LocalDateTime.now());

        given(sessionService.joinSession(any(), eq(42L))).willReturn(response);

        mockMvc.perform(post("/api/sessions/42/join")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.user_id").value(10))
                .andExpect(jsonPath("$.answer_status").value("WAITING"));
    }

    @Test
    void 세션_참여_이미참여한경우_400() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");

        given(sessionService.joinSession(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(post("/api/sessions/42/join")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 세션_참여_인증없이_401() throws Exception {
        mockMvc.perform(post("/api/sessions/42/join"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 참여자_상태변경_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        ParticipantStatusRequest request = new ParticipantStatusRequest("answering");
        ParticipantStatusResponse response = new ParticipantStatusResponse(42L, 10L, AnswerStatus.ANSWERING, LocalDateTime.now());

        given(sessionService.updateParticipantStatus(any(), eq(42L), eq(10L), any())).willReturn(response);

        mockMvc.perform(patch("/api/sessions/42/participants/10/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.user_id").value(10))
                .andExpect(jsonPath("$.answer_status").value("ANSWERING"));
    }

    @Test
    void 참여자_상태변경_본인아닌경우_403() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        ParticipantStatusRequest request = new ParticipantStatusRequest("answering");

        given(sessionService.updateParticipantStatus(any(), eq(42L), eq(99L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(patch("/api/sessions/42/participants/99/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }
}
