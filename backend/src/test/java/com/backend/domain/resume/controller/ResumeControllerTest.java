package com.backend.domain.resume.controller;

import com.backend.domain.resume.dto.request.ResumeSaveRequest;
import com.backend.domain.resume.dto.response.ResumeSkillDetailInfo;
import com.backend.domain.resume.dto.response.ResumeSkillsResponse;
import com.backend.domain.resume.dto.response.ResumeSaveResponse;
import com.backend.domain.resume.service.ResumeService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ResumeControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtProvider jwtProvider;

    @MockitoBean
    private ResumeService resumeService;

    // ===== 자소서 저장 =====

    @Test
    void 자소서_저장_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        ResumeSaveRequest request = new ResumeSaveRequest("저는 3년간 백엔드 개발자로...");
        ResumeSaveResponse response = new ResumeSaveResponse(7L, 42L, "저는 3년간 백엔드 개발자로...", LocalDateTime.now());

        given(resumeService.saveResume(any(), eq(42L), any())).willReturn(response);

        mockMvc.perform(post("/api/sessions/42/resume")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.content").value("저는 3년간 백엔드 개발자로..."));
    }

    @Test
    void 자소서_저장_인증없이_401() throws Exception {
        ResumeSaveRequest request = new ResumeSaveRequest("내용");

        mockMvc.perform(post("/api/sessions/42/resume")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 자소서_저장_멘티외_접근_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        ResumeSaveRequest request = new ResumeSaveRequest("내용");

        given(resumeService.saveResume(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/sessions/42/resume")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 자소서_저장_빈문자열_400() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        ResumeSaveRequest request = new ResumeSaveRequest("");

        mockMvc.perform(post("/api/sessions/42/resume")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 자소서_저장_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        ResumeSaveRequest request = new ResumeSaveRequest("내용");

        given(resumeService.saveResume(any(), eq(999L), any()))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(post("/api/sessions/999/resume")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // ===== 자소서 역량 조회 =====

    @Test
    void 자소서_역량조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        ResumeSkillsResponse response = new ResumeSkillsResponse(7L, List.of(
                new ResumeSkillDetailInfo(1L, "Spring Boot"),
                new ResumeSkillDetailInfo(2L, "JPA")
        ));

        given(resumeService.getResumeSkills(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/resume/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resume_id").value(7))
                .andExpect(jsonPath("$.skills[0].id").value(1))
                .andExpect(jsonPath("$.skills[0].skill_name").value("Spring Boot"))
                .andExpect(jsonPath("$.skills[1].skill_name").value("JPA"));
    }

    @Test
    void 자소서_역량조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/resume/skills"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 자소서_역량조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(resumeService.getResumeSkills(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/resume/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 자소서_역량조회_자소서없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");

        given(resumeService.getResumeSkills(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.RESUME_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/resume/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
