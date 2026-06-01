package com.backend.domain.analysisReport.controller;

import com.backend.domain.analysisReport.dto.request.MentorFeedbackRequest;
import com.backend.domain.analysisReport.dto.response.FitGapResponse;
import com.backend.domain.analysisReport.dto.response.JobSkillInfo;
import com.backend.domain.analysisReport.dto.response.MentorFeedbackResponse;
import com.backend.domain.analysisReport.dto.response.ReportResponse;
import com.backend.domain.analysisReport.dto.response.ResumeSkillInfo;
import com.backend.domain.analysisReport.service.ReportService;
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
class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private ReportService reportService;

    // ===== 리포트 조회 =====

    @Test
    void 리포트_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        ReportResponse response = new ReportResponse(
                10L, 42L, "first", 3.9f, 0.72f,
                "3번 질문 답변에서 STAR 구조가 명확함",
                "1번 질문에서 dead air 3회 발생",
                null, LocalDateTime.now(), LocalDateTime.now()
        );

        given(reportService.getReport(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/report")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.report_status").value("first"))
                .andExpect(jsonPath("$.total_score").value(3.9))
                .andExpect(jsonPath("$.alignment_score").value(0.72))
                .andExpect(jsonPath("$.best_moment").value("3번 질문 답변에서 STAR 구조가 명확함"))
                .andExpect(jsonPath("$.mentor_feedback").doesNotExist());
    }

    @Test
    void 리포트_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/report"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 리포트_조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(reportService.getReport(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/report")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 리포트_조회_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(reportService.getReport(any(), eq(999L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/999/report")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void 리포트_조회_리포트없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(reportService.getReport(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.REPORT_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/report")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ===== Fit-Gap 역량 분석 조회 =====

    @Test
    void FitGap_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        FitGapResponse response = new FitGapResponse(
                10L,
                List.of(new JobSkillInfo("Spring Boot", "required"), new JobSkillInfo("Kubernetes", "preferred")),
                List.of(new ResumeSkillInfo("Spring Boot"), new ResumeSkillInfo("JPA")),
                List.of("Spring Boot"),
                List.of("Kubernetes")
        );

        given(reportService.getFitGap(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/report/fit-gap")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report_id").value(10))
                .andExpect(jsonPath("$.job_skills[0].skill_name").value("Spring Boot"))
                .andExpect(jsonPath("$.job_skills[0].skill_type").value("required"))
                .andExpect(jsonPath("$.job_skills[1].skill_name").value("Kubernetes"))
                .andExpect(jsonPath("$.resume_skills[0].skill_name").value("Spring Boot"))
                .andExpect(jsonPath("$.matched[0]").value("Spring Boot"))
                .andExpect(jsonPath("$.unmatched[0]").value("Kubernetes"));
    }

    @Test
    void FitGap_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/report/fit-gap"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void FitGap_조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(reportService.getFitGap(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/report/fit-gap")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void FitGap_조회_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(reportService.getFitGap(any(), eq(999L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/999/report/fit-gap")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ===== 멘토 종합 피드백 작성 =====

    @Test
    void 멘토_피드백_작성_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorFeedbackRequest request = new MentorFeedbackRequest(
                "전반적으로 답변 구조가 잘 잡혀 있으나 구체적인 수치 제시가 부족합니다.",
                4.2f
        );
        MentorFeedbackResponse response = new MentorFeedbackResponse(
                10L, "final",
                "전반적으로 답변 구조가 잘 잡혀 있으나 구체적인 수치 제시가 부족합니다.",
                4.2f,
                LocalDateTime.now()
        );

        given(reportService.addMentorFeedback(any(), eq(42L), any())).willReturn(response);

        mockMvc.perform(patch("/api/sessions/42/report/mentor-feedback")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.report_status").value("final"))
                .andExpect(jsonPath("$.mentor_feedback").value("전반적으로 답변 구조가 잘 잡혀 있으나 구체적인 수치 제시가 부족합니다."))
                .andExpect(jsonPath("$.mentor_score").value(4.2));
    }

    @Test
    void 멘토_피드백_작성_인증없이_401() throws Exception {
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백", 4.0f);

        mockMvc.perform(patch("/api/sessions/42/report/mentor-feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 멘토_피드백_작성_멘토외_접근_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백", 4.0f);

        given(reportService.addMentorFeedback(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(patch("/api/sessions/42/report/mentor-feedback")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 멘토_피드백_작성_빈문자열_400() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorFeedbackRequest request = new MentorFeedbackRequest("", 4.0f);

        mockMvc.perform(patch("/api/sessions/42/report/mentor-feedback")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 멘토_피드백_작성_리포트없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorFeedbackRequest request = new MentorFeedbackRequest("피드백", 4.0f);

        given(reportService.addMentorFeedback(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.REPORT_NOT_FOUND));

        mockMvc.perform(patch("/api/sessions/42/report/mentor-feedback")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }
}
