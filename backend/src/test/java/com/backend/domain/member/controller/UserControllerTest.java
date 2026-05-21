package com.backend.domain.member.controller;

import com.backend.domain.member.dto.request.UserProfileUpdateRequest;
import com.backend.domain.member.dto.response.MySessionHistoryResponse;
import com.backend.domain.member.dto.response.SessionHistoryItemResponse;
import com.backend.domain.member.dto.response.UserProfileResponse;
import com.backend.domain.member.dto.response.UserProfileUpdateResponse;
import com.backend.domain.member.service.UserService;
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
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private UserService userService;

    @Test
    void 내_프로필_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        UserProfileResponse response = new UserProfileResponse(
                1L, "홍길동", "hong@test.com", "mentee",
                List.of(new UserProfileResponse.TagInfo(1L, "Spring", "job_skill")),
                LocalDateTime.now()
        );
        given(userService.getMyProfile(any())).willReturn(response);

        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("홍길동"))
                .andExpect(jsonPath("$.email").value("hong@test.com"))
                .andExpect(jsonPath("$.role").value("mentee"))
                .andExpect(jsonPath("$.tags[0].name").value("Spring"))
                .andExpect(jsonPath("$.tags[0].category").value("job_skill"))
                .andExpect(jsonPath("$.created_at").exists());
    }

    @Test
    void 내_프로필_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 내_프로필_수정_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        UserProfileUpdateRequest request = new UserProfileUpdateRequest("새이름", null, null); // tags null = 변경 없음
        UserProfileUpdateResponse response = new UserProfileUpdateResponse(1L, "새이름", LocalDateTime.now());
        given(userService.updateMyProfile(any(), any())).willReturn(response);

        mockMvc.perform(patch("/api/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("새이름"))
                .andExpect(jsonPath("$.updated_at").exists());
    }

    @Test
    void 내_프로필_수정_수정할_필드_없음_400() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        UserProfileUpdateRequest request = new UserProfileUpdateRequest(null, null, null);
        given(userService.updateMyProfile(any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(patch("/api/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 내_프로필_수정_인증없이_401() throws Exception {
        mockMvc.perform(patch("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 내_면접내역_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        MySessionHistoryResponse response = new MySessionHistoryResponse(
                List.of(new SessionHistoryItemResponse(42L, "백엔드 개발", "completed", "final", LocalDateTime.now())),
                1L, 1
        );
        given(userService.getMySessionHistory(any(), any())).willReturn(response);

        mockMvc.perform(get("/api/users/me/sessions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(42))
                .andExpect(jsonPath("$.content[0].job_category").value("백엔드 개발"))
                .andExpect(jsonPath("$.content[0].status").value("completed"))
                .andExpect(jsonPath("$.content[0].report_status").value("final"))
                .andExpect(jsonPath("$.total_elements").value(1))
                .andExpect(jsonPath("$.total_pages").value(1));
    }

    @Test
    void 내_면접내역_조회_report_status_null_포함_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        MySessionHistoryResponse response = new MySessionHistoryResponse(
                List.of(new SessionHistoryItemResponse(10L, "프론트엔드 개발", "scheduled", null, null)),
                1L, 1
        );
        given(userService.getMySessionHistory(any(), any())).willReturn(response);

        mockMvc.perform(get("/api/users/me/sessions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(10))
                .andExpect(jsonPath("$.content[0].report_status").isEmpty());
    }

    @Test
    void 내_면접내역_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/users/me/sessions"))
                .andExpect(status().isUnauthorized());
    }
}
