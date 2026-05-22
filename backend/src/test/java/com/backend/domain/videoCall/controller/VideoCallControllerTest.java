package com.backend.domain.videoCall.controller;

import com.backend.domain.videoCall.dto.response.VideoTokenResponse;
import com.backend.domain.videoCall.service.VideoCallService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class VideoCallControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private VideoCallService videoCallService;

    @Test
    void 토큰_발급_성공_멘토_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        VideoTokenResponse response = new VideoTokenResponse("eyJ.mock.token", "session-42", "ws://localhost:7880");

        given(videoCallService.getToken(eq(1L), eq(42L))).willReturn(response);

        mockMvc.perform(post("/api/video/42/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("eyJ.mock.token"))
                .andExpect(jsonPath("$.room_name").value("session-42"))
                .andExpect(jsonPath("$.livekit_url").value("ws://localhost:7880"));
    }

    @Test
    void 토큰_발급_성공_멘티_200() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        VideoTokenResponse response = new VideoTokenResponse("eyJ.mock.token", "session-42", "ws://localhost:7880");

        given(videoCallService.getToken(eq(10L), eq(42L))).willReturn(response);

        mockMvc.perform(post("/api/video/42/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room_name").value("session-42"));
    }

    @Test
    void 토큰_발급_인증없이_401() throws Exception {
        mockMvc.perform(post("/api/video/42/token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 토큰_발급_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(videoCallService.getToken(any(), eq(999L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(post("/api/video/999/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void 토큰_발급_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(videoCallService.getToken(eq(99L), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/video/42/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 토큰_발급_종료된세션_400() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(videoCallService.getToken(eq(1L), eq(42L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_JOINABLE));

        mockMvc.perform(post("/api/video/42/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }
}
