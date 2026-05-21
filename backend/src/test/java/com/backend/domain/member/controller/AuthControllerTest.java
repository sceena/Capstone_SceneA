package com.backend.domain.member.controller;

import com.backend.domain.member.dto.request.LoginRequest;
import com.backend.domain.member.dto.request.SignupRequest;
import com.backend.domain.member.dto.response.LoginResponse;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.service.AuthService;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private AuthService authService;

    @Test
    void 회원가입_성공_200() throws Exception {
        SignupRequest request = new SignupRequest("test@test.com", "password", "홍길동", "길동이", Role.MENTEE, null);
        willDoNothing().given(authService).signup(any());

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void 로그인_성공_200_토큰반환() throws Exception {
        LoginRequest request = new LoginRequest("test@test.com", "password");
        LoginResponse response = new LoginResponse("access-token", "refresh-token");
        given(authService.login(any())).willReturn(response);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").value("access-token"))
                .andExpect(jsonPath("$.refresh_token").value("refresh-token"));
    }

    @Test
    void 로그아웃_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void 회원탈퇴_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        willDoNothing().given(authService).withdraw(any());

        mockMvc.perform(delete("/api/auth/withdraw")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void 인증없이_보호된_엔드포인트_401() throws Exception {
        mockMvc.perform(delete("/api/auth/withdraw"))
                .andExpect(status().isUnauthorized());
    }
}
