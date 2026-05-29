package com.backend.domain.interviewAnswer.controller;

import com.backend.domain.interviewAnswer.dto.request.MentorScoreRequest;
import com.backend.domain.interviewAnswer.dto.response.AnswerDetailResponse;
import com.backend.domain.interviewAnswer.dto.response.AnswerUploadResponse;
import com.backend.domain.interviewAnswer.dto.response.MentorScoreResponse;
import com.backend.domain.interviewAnswer.service.AnswerService;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AnswerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private AnswerService answerService;

    // ── POST /api/sessions/{id}/questions/{questionId}/answers ────────────────

    @Test
    void 답변_업로드_성공_201() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        LocalDateTime now = LocalDateTime.now();
        AnswerUploadResponse response = new AnswerUploadResponse(
                201L, 42L, 101L, 10L, now, now.plusSeconds(90), null, null, null, null, null, null, now);

        MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav", "audio".getBytes());
        given(answerService.uploadAnswer(any(), eq(42L), eq(101L), any(), any(), any(), any()))
                .willReturn(response);

        mockMvc.perform(multipart("/api/sessions/42/questions/101/answers")
                        .file(audio)
                        .param("answer_start", "2025-04-01T14:05:00")
                        .param("answer_end", "2025-04-01T14:06:30")
                        .param("mentee_id", "10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(201))
                .andExpect(jsonPath("$.session_id").value(42))
                .andExpect(jsonPath("$.question_id").value(101))
                .andExpect(jsonPath("$.mentee_id").value(10))
                .andExpect(jsonPath("$.stt_text").isEmpty())
                .andExpect(jsonPath("$.ai_score").isEmpty())
                .andExpect(jsonPath("$.created_at").exists());
    }

    @Test
    void 답변_업로드_인증없이_401() throws Exception {
        MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav", "audio".getBytes());

        mockMvc.perform(multipart("/api/sessions/42/questions/101/answers")
                        .file(audio)
                        .param("answer_start", "2025-04-01T14:05:00")
                        .param("answer_end", "2025-04-01T14:06:30")
                        .param("mentee_id", "10"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 답변_업로드_멘티아님_403() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav", "audio".getBytes());

        given(answerService.uploadAnswer(any(), eq(42L), eq(101L), any(), any(), any(), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(multipart("/api/sessions/42/questions/101/answers")
                        .file(audio)
                        .param("answer_start", "2025-04-01T14:05:00")
                        .param("answer_end", "2025-04-01T14:06:30")
                        .param("mentee_id", "1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 답변_업로드_세션없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav", "audio".getBytes());

        given(answerService.uploadAnswer(any(), eq(999L), eq(101L), any(), any(), any(), any()))
                .willThrow(new CustomException(ErrorCode.SESSION_NOT_FOUND));

        mockMvc.perform(multipart("/api/sessions/999/questions/101/answers")
                        .file(audio)
                        .param("answer_start", "2025-04-01T14:05:00")
                        .param("answer_end", "2025-04-01T14:06:30")
                        .param("mentee_id", "10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ── GET /api/sessions/{id}/questions/{questionId}/answers ─────────────────

    @Test
    void 답변_목록조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        LocalDateTime now = LocalDateTime.now();
        List<AnswerDetailResponse> response = List.of(
                new AnswerDetailResponse(201L, 42L, 101L, 10L, "저는 Spring Boot로...", null, null, null, now, now.plusSeconds(90), 4.2f, null, null, now),
                new AnswerDetailResponse(202L, 42L, 101L, 11L, null, null, null, null, now, now.plusSeconds(60), null, null, null, now)
        );

        given(answerService.getAnswers(any(), eq(42L), eq(101L))).willReturn(response);

        mockMvc.perform(get("/api/sessions/42/questions/101/answers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(201))
                .andExpect(jsonPath("$[0].session_id").value(42))
                .andExpect(jsonPath("$[0].question_id").value(101))
                .andExpect(jsonPath("$[0].mentee_id").value(10))
                .andExpect(jsonPath("$[0].stt_text").value("저는 Spring Boot로..."))
                .andExpect(jsonPath("$[0].ai_score").value(4.2))
                .andExpect(jsonPath("$[1].id").value(202));
    }

    @Test
    void 답변_목록조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/questions/101/answers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 답변_목록조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(answerService.getAnswers(any(), eq(42L), eq(101L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 답변_목록조회_질문없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");

        given(answerService.getAnswers(any(), eq(42L), eq(999L)))
                .willThrow(new CustomException(ErrorCode.QUESTION_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/999/answers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ── GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/audio ─

    @Test
    void 오디오_조회_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        Resource audioResource = new ByteArrayResource("audio content".getBytes());

        given(answerService.getAudio(any(), eq(42L), eq(101L), eq(201L))).willReturn(audioResource);

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/audio")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("inline")));
    }

    @Test
    void 오디오_조회_인증없이_401() throws Exception {
        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/audio"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 오디오_조회_권한없음_403() throws Exception {
        String token = jwtProvider.generateAccessToken(99L, "MENTEE");

        given(answerService.getAudio(any(), eq(42L), eq(101L), eq(201L)))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/201/audio")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 오디오_조회_답변없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");

        given(answerService.getAudio(any(), eq(42L), eq(101L), eq(999L)))
                .willThrow(new CustomException(ErrorCode.ANSWER_NOT_FOUND));

        mockMvc.perform(get("/api/sessions/42/questions/101/answers/999/audio")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ── PATCH /api/sessions/{id}/questions/{questionId}/answers/{answerId}/mentor-score

    @Test
    void 별점_입력_성공_200() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorScoreRequest request = new MentorScoreRequest(4.0f);
        MentorScoreResponse response = new MentorScoreResponse(201L, 4.2f, 4.0f, 0.2f, LocalDateTime.now());

        given(answerService.updateMentorScore(any(), eq(42L), eq(101L), eq(201L), any()))
                .willReturn(response);

        mockMvc.perform(patch("/api/sessions/42/questions/101/answers/201/mentor-score")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(201))
                .andExpect(jsonPath("$.mentor_score").value(4.0))
                .andExpect(jsonPath("$.ai_score").value(4.2))
                .andExpect(jsonPath("$.gap").value(0.2))
                .andExpect(jsonPath("$.updated_at").exists());
    }

    @Test
    void 별점_입력_인증없이_401() throws Exception {
        MentorScoreRequest request = new MentorScoreRequest(4.0f);

        mockMvc.perform(patch("/api/sessions/42/questions/101/answers/201/mentor-score")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 별점_입력_멘토아님_403() throws Exception {
        String token = jwtProvider.generateAccessToken(10L, "MENTEE");
        MentorScoreRequest request = new MentorScoreRequest(4.0f);

        given(answerService.updateMentorScore(any(), eq(42L), eq(101L), eq(201L), any()))
                .willThrow(new CustomException(ErrorCode.ACCESS_DENIED));

        mockMvc.perform(patch("/api/sessions/42/questions/101/answers/201/mentor-score")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void 별점_입력_잘못된값_400() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorScoreRequest request = new MentorScoreRequest(6.0f);

        given(answerService.updateMentorScore(any(), eq(42L), eq(101L), eq(201L), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_REQUEST));

        mockMvc.perform(patch("/api/sessions/42/questions/101/answers/201/mentor-score")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 별점_입력_답변없음_404() throws Exception {
        String token = jwtProvider.generateAccessToken(1L, "MENTOR");
        MentorScoreRequest request = new MentorScoreRequest(4.0f);

        given(answerService.updateMentorScore(any(), eq(42L), eq(101L), eq(999L), any()))
                .willThrow(new CustomException(ErrorCode.ANSWER_NOT_FOUND));

        mockMvc.perform(patch("/api/sessions/42/questions/101/answers/999/mentor-score")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }
}
