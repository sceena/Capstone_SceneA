package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.ai.dto.response.AiQuestionReportResponse;
import com.backend.domain.ai.dto.response.AiReportResponse;
import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.answerEvaluation.dto.response.AnswerEvaluationResponse;
import com.backend.domain.interviewSession.entity.InterviewSession;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ReportResponseTest {

    @Test
    void from_멘토_수정본을_AI질문리포트에_병합한다() {
        InterviewSession session = InterviewSession.builder()
                .jobCategory("백엔드")
                .scheduledAt(LocalDateTime.now())
                .build();
        ReflectionTestUtils.setField(session, "id", 42L);
        AnalysisReport report = AnalysisReport.builder()
                .interviewSession(session)
                .aiSummary("AI 요약")
                .totalScore(7.0f)
                .build();
        ReflectionTestUtils.setField(report, "id", 10L);

        AiReportResponse aiReport = new AiReportResponse(
                42L,
                7.0f,
                null,
                null,
                List.of(new AiQuestionReportResponse(
                        100L,
                        200L,
                        300L,
                        "멘티",
                        "질문",
                        "AI 답변",
                        6.0f,
                        "AI 근거",
                        List.of("AI 강점"),
                        List.of("AI 개선점"),
                        "ai",
                        "gemini",
                        "v1",
                        null
                ))
        );
        AnswerEvaluationResponse mentorEvaluation = new AnswerEvaluationResponse(
                1L,
                200L,
                100L,
                300L,
                "질문",
                "AI 답변",
                "answers/sample.webm",
                "AI 근거",
                6.0f,
                List.of("AI 강점"),
                List.of("AI 개선점"),
                "멘토가 수정한 근거",
                9.0f,
                List.of("멘토 강점"),
                List.of("멘토 개선점"),
                "gemini",
                "v1",
                "ai",
                null,
                null
        );

        ReportResponse response = ReportResponse.from(report, aiReport, List.of(mentorEvaluation));

        AiQuestionReportResponse merged = response.aiReport().questionReports().getFirst();
        assertThat(merged.score()).isEqualTo(9.0f);
        assertThat(merged.reasoning()).isEqualTo("멘토가 수정한 근거");
        assertThat(merged.strengths()).containsExactly("멘토 강점");
        assertThat(merged.improvements()).containsExactly("멘토 개선점");
        assertThat(response.answerEvaluations()).containsExactly(mentorEvaluation);
    }
}
