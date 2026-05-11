package com.backend.domain.jobPosting.controller;

import com.backend.domain.jobPosting.dto.request.JobPostingSaveRequest;
import com.backend.domain.jobPosting.dto.response.JobPostingSaveResponse;
import com.backend.domain.jobPosting.dto.response.JobSkillDetailInfo;
import com.backend.domain.jobPosting.dto.response.JobSkillsResponse;
import com.backend.domain.jobPosting.service.JobPostingService;
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
class JobPostingControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtProvider jwtProvider;

    @MockitoBean
    private JobPostingService jobPostingService;

    // ===== 채용공고 저장 =====

    @Test
    void 채용공고_저장_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무: Spring Boot...", "https://recruit.naver.com");
        JobPostingSaveResponse response = new JobPostingSaveResponse(12L, "네이버", "백엔드 개발", "주요업무: Spring Boot...", "https://recruit.naver.com", 42L, LocalDateTime.now());

        given(jobPostingService.saveJobPosting(any(), eq(42L), any())).willReturn(response);

        mockMvc.perform(post("/api/sessions/42/job-posting")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(12))
                .andExpect(jsonPath("$.company").value("네이버"))
                .andExpect(jsonPath("$.job_category").value("백엔드 개발"))
                .andExpect(jsonPath("$.raw_text").value("주요업무: Spring Boot..."))
                .andExpect(jsonPath("$.session_id").value(42));
    }

    @Test
    void 채용공고_저장_인증없이_401() throws Exception {
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);

        mockMvc.perform(post("/api/sessions/42/job-posting")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 채용공고_저장_멘티외_접근_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);

        given(jobPostingService.saveJobPosting(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/sessions/42/job-posting")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 채용공고_저장_필수필드_누락_400() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        JobPostingSaveRequest request = new JobPostingSaveRequest("", "백엔드 개발", "주요업무...", null);

        mockMvc.perform(post("/api/sessions/42/job-posting")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 채용공고_저장_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(2L, "MENTEE");
        JobPostingSaveRequest request = new JobPostingSaveRequest("네이버", "백엔드 개발", "주요업무...", null);

        given(jobPostingService.saveJobPosting(any(), eq(999L), any()))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(post("/api/sessions/999/job-posting")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // ===== 채용공고 역량 조회 =====

    @Test
    void 채용공고_역량조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        JobSkillsResponse response = new JobSkillsResponse(12L, List.of(
                new JobSkillDetailInfo(1L, "Spring Boot", "required"),
                new JobSkillDetailInfo(2L, "Docker", "preferred")
        ));

        given(jobPostingService.getJobSkills(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/job-posting/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job_posting_id").value(12))
                .andExpect(jsonPath("$.skills[0].id").value(1))
                .andExpect(jsonPath("$.skills[0].skill_name").value("Spring Boot"))
                .andExpect(jsonPath("$.skills[0].skill_type").value("required"))
                .andExpect(jsonPath("$.skills[1].skill_name").value("Docker"))
                .andExpect(jsonPath("$.skills[1].skill_type").value("preferred"));
    }

    @Test
    void 채용공고_역량조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/job-posting/skills"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 채용공고_역량조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(jobPostingService.getJobSkills(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/job-posting/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 채용공고_역량조회_채용공고없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(jobPostingService.getJobSkills(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.JOB_POSTING_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/job-posting/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
