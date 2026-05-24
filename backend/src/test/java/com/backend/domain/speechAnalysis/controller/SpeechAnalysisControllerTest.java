package com.backend.domain.speechAnalysis.controller;

import com.backend.domain.speechAnalysis.dto.response.ScriptSegmentResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse.AnswerSummaryItem;
import com.backend.domain.speechAnalysis.dto.response.SpeechAnalysisResponse;
import com.backend.domain.speechAnalysis.service.SpeechAnalysisService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SpeechAnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private SpeechAnalysisService speechAnalysisService;

    // ===== 답변 AI 분석 결과 조회 =====

    @Test
    void AI분석_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SpeechAnalysisResponse response = new SpeechAnalysisResponse(
                201L, "저는 당시 Spring Boot로...", 142.5f, 2, 3.2f, 18.4f,
                true, true, false, false, 0.5f, 3.8f
        );

        given(speechAnalysisService.getAnalysis(any(), eq(42L), eq(101L), eq(201L)))
                .willReturn(response);

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer_id").value(201))
                .andExpect(jsonPath("$.stt_text").value("저는 당시 Spring Boot로..."))
                .andExpect(jsonPath("$.wpm").value(142.5))
                .andExpect(jsonPath("$.dead_air_count").value(2))
                .andExpect(jsonPath("$.response_delay_sec").value(3.2))
                .andExpect(jsonPath("$.is_star_s").value(true))
                .andExpect(jsonPath("$.is_star_a").value(false))
                .andExpect(jsonPath("$.star_ratio").value(0.5))
                .andExpect(jsonPath("$.ai_score").value(3.8));
    }

    @Test
    void AI분석_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/analysis"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void AI분석_조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(speechAnalysisService.getAnalysis(any(), eq(42L), eq(101L), eq(201L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void AI분석_조회_답변없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(speechAnalysisService.getAnalysis(any(), eq(42L), eq(101L), eq(999L)))
                .willThrow(new CustomException(ErrorCode.ANSWER_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/999/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void AI분석_조회_분석결과없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(speechAnalysisService.getAnalysis(any(), eq(42L), eq(101L), eq(201L)))
                .willThrow(new CustomException(ErrorCode.ANALYSIS_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ===== 답변 스크립트 세그먼트 조회 =====

    @Test
    void 세그먼트_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTEE");
        List<ScriptSegmentResponse> response = List.of(
                new ScriptSegmentResponse(301L, 201L, "저는 당시 팀의 리더로서...", "highlight", 0),
                new ScriptSegmentResponse(302L, 201L, "하지만 배포 일정이 급해졌고...", "normal", 1)
        );

        given(speechAnalysisService.getSegments(any(), eq(42L), eq(101L), eq(201L)))
                .willReturn(response);

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/segments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(301))
                .andExpect(jsonPath("$[0].answer_id").value(201))
                .andExpect(jsonPath("$[0].segment_text").value("저는 당시 팀의 리더로서..."))
                .andExpect(jsonPath("$[0].segment_type").value("highlight"))
                .andExpect(jsonPath("$[0].order_index").value(0))
                .andExpect(jsonPath("$[1].segment_type").value("normal"));
    }

    @Test
    void 세그먼트_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/segments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 세그먼트_조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(speechAnalysisService.getSegments(any(), eq(42L), eq(101L), eq(201L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/segments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 세그먼트_조회_분석결과없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(speechAnalysisService.getSegments(any(), eq(42L), eq(101L), eq(201L)))
                .willThrow(new CustomException(ErrorCode.ANALYSIS_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/segments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ===== 세션 AI 분석 요약 조회 =====

    @Test
    void AI분석_요약_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionAnalysisSummaryResponse response = new SessionAnalysisSummaryResponse(
                42L,
                List.of(
                        new AnswerSummaryItem(201L, 3.8f, 142.5f, 0.5f),
                        new AnswerSummaryItem(202L, 4.5f, 130.0f, 0.75f)
                ),
                202L,
                201L
        );

        given(speechAnalysisService.getSummary(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/analysis/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.answers[0].answer_id").value(201))
                .andExpect(jsonPath("$.answers[0].ai_score").value(3.8))
                .andExpect(jsonPath("$.answers[0].wpm").value(142.5))
                .andExpect(jsonPath("$.answers[0].star_ratio").value(0.5))
                .andExpect(jsonPath("$.answers[1].answer_id").value(202))
                .andExpect(jsonPath("$.best_answer_id").value(202))
                .andExpect(jsonPath("$.worst_answer_id").value(201));
    }

    @Test
    void AI분석_요약_분석된_답변없으면_best_worst_null() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        SessionAnalysisSummaryResponse response = new SessionAnalysisSummaryResponse(
                42L, List.of(), null, null
        );

        given(speechAnalysisService.getSummary(any(), eq(42L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/analysis/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers").isEmpty())
                .andExpect(jsonPath("$.best_answer_id").doesNotExist())
                .andExpect(jsonPath("$.worst_answer_id").doesNotExist());
    }

    @Test
    void AI분석_요약_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/analysis/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void AI분석_요약_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(speechAnalysisService.getSummary(any(), eq(42L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/analysis/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void AI분석_요약_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(speechAnalysisService.getSummary(any(), eq(999L)))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/999/analysis/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
