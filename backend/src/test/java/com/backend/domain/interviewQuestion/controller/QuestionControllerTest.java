package com.backend.domain.interviewQuestion.controller;

import com.backend.domain.interviewQuestion.dto.request.QuestionCreateRequest;
import com.backend.domain.interviewQuestion.dto.request.QuestionUpdateRequest;
import com.backend.domain.interviewQuestion.dto.response.QuestionCreateResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionDetailResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionUpdateResponse;
import com.backend.domain.interviewQuestion.service.QuestionService;
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
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class QuestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private QuestionService questionService;

    // ── POST /api/sessions/{id}/questions ─────────────────────────────────────

    @Test
    void 질문_생성_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        QuestionCreateRequest request = new QuestionCreateRequest(List.of(
                new QuestionCreateRequest.QuestionItem("가장 복잡한 시스템 설계 사례를 말씀해 주세요."),
                new QuestionCreateRequest.QuestionItem("가장 어려웠던 트레이드오프는 무엇이었나요?")
        ));
        List<QuestionCreateResponse> response = List.of(
                new QuestionCreateResponse(101L, 42L, "가장 복잡한 시스템 설계 사례를 말씀해 주세요.", null, LocalDateTime.now()),
                new QuestionCreateResponse(102L, 42L, "가장 어려웠던 트레이드오프는 무엇이었나요?", null, LocalDateTime.now())
        );

        given(questionService.createQuestions(any(), eq(42L), any())).willReturn(response);

        mockMvc.perform(post("/api/sessions/42/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].id").value(101))
                .andExpect(jsonPath("$[0].session_id").value(42))
                .andExpect(jsonPath("$[0].content").value("가장 복잡한 시스템 설계 사례를 말씀해 주세요."))
                .andExpect(jsonPath("$[1].id").value(102));
    }

    @Test
    void 질문_생성_인증없이_401() throws Exception {
        QuestionCreateRequest request = new QuestionCreateRequest(List.of(
                new QuestionCreateRequest.QuestionItem("질문 내용")
        ));

        mockMvc.perform(post("/api/sessions/42/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 질문_생성_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");
        QuestionCreateRequest request = new QuestionCreateRequest(List.of(
                new QuestionCreateRequest.QuestionItem("질문 내용")
        ));

        given(questionService.createQuestions(any(), eq(42L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(post("/api/sessions/42/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 질문_생성_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        QuestionCreateRequest request = new QuestionCreateRequest(List.of(
                new QuestionCreateRequest.QuestionItem("질문 내용")
        ));

        given(questionService.createQuestions(any(), eq(999L), any()))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(post("/api/sessions/999/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // ── GET /api/sessions/{id}/questions ──────────────────────────────────────

    @Test
    void 질문_목록조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        LocalDateTime now = LocalDateTime.now();
        List<QuestionDetailResponse> response = List.of(
                new QuestionDetailResponse(101L, 42L, "가장 복잡한 시스템 설계 사례를 말씀해 주세요.", null, now, now),
                new QuestionDetailResponse(102L, 42L, "가장 어려웠던 트레이드오프는 무엇이었나요?", null, now, now)
        );

        given(questionService.getQuestions(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/questions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(101))
                .andExpect(jsonPath("$[0].session_id").value(42))
                .andExpect(jsonPath("$[0].updated_at").exists())
                .andExpect(jsonPath("$[1].id").value(102));
    }

    @Test
    void 질문_목록조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/questions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 질문_목록조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(questionService.getQuestions(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/questions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // ── GET /api/sessions/{id}/questions/{questionId} ─────────────────────────

    @Test
    void 질문_단건조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        LocalDateTime now = LocalDateTime.now();
        QuestionDetailResponse response = new QuestionDetailResponse(
                101L, 42L, "가장 복잡한 시스템 설계 사례를 말씀해 주세요.", null, now, now
        );

        given(questionService.getQuestion(any(), eq(42L), eq(101L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.content").value("가장 복잡한 시스템 설계 사례를 말씀해 주세요."))
                .andExpect(jsonPath("$.created_at").exists())
                .andExpect(jsonPath("$.updated_at").exists());
    }

    @Test
    void 질문_단건조회_없는질문_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(questionService.getQuestion(any(), eq(42L), eq(999L)))
                .willThrow(new CustomException(ErrorCode.QUESTION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ── PATCH /api/sessions/{id}/questions/{questionId} ───────────────────────

    @Test
    void 질문_수정_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        QuestionUpdateRequest request = new QuestionUpdateRequest("가장 복잡했던 시스템 설계 경험과 선택한 아키텍처의 이유를 설명해 주세요.");
        QuestionUpdateResponse response = new QuestionUpdateResponse(
                101L, 42L, "가장 복잡했던 시스템 설계 경험과 선택한 아키텍처의 이유를 설명해 주세요.", LocalDateTime.now()
        );

        given(questionService.updateQuestion(any(), eq(42L), eq(101L), any())).willReturn(response);

        mockMvc.perform(patch("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.content").value("가장 복잡했던 시스템 설계 경험과 선택한 아키텍처의 이유를 설명해 주세요."))
                .andExpect(jsonPath("$.updated_at").exists());
    }

    @Test
    void 질문_수정_면접시작후_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        QuestionUpdateRequest request = new QuestionUpdateRequest("수정 내용");

        given(questionService.updateQuestion(any(), eq(42L), eq(101L), any()))
                .willThrow(new CustomException(ErrorCode.QUESTION_MODIFICATION_LOCKED));

        mockMvc.perform(patch("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 질문_수정_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");
        QuestionUpdateRequest request = new QuestionUpdateRequest("수정 내용");

        given(questionService.updateQuestion(any(), eq(42L), eq(101L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(patch("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // ── DELETE /api/sessions/{id}/questions/{questionId} ──────────────────────

    @Test
    void 질문_삭제_성공_204() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        willDoNothing().given(questionService).deleteQuestion(any(), eq(42L), eq(101L));

        mockMvc.perform(delete("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void 질문_삭제_면접시작후_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        willThrow(new CustomException(ErrorCode.QUESTION_MODIFICATION_LOCKED))
                .given(questionService).deleteQuestion(any(), eq(42L), eq(101L));

        mockMvc.perform(delete("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 질문_삭제_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        willThrow(new CustomException(ErrorCode.ACCESS_DENIED))
                .given(questionService).deleteQuestion(any(), eq(42L), eq(101L));

        mockMvc.perform(delete("/api/sessions/42/questions/101")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 질문_삭제_없는질문_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        willThrow(new CustomException(ErrorCode.QUESTION_NOT_FOUND))
                .given(questionService).deleteQuestion(any(), eq(42L), eq(999L));

        mockMvc.perform(delete("/api/sessions/42/questions/999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
