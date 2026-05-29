package com.backend.domain.interviewAnswer.dto.response;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record SessionSttStatusResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("total_count") int totalCount,
        @JsonProperty("completed_count") int completedCount,
        @JsonProperty("pending_count") int pendingCount,
        @JsonProperty("processing_count") int processingCount,
        @JsonProperty("failed_count") int failedCount,
        @JsonProperty("question_pending_count") int questionPendingCount,
        @JsonProperty("question_processing_count") int questionProcessingCount,
        @JsonProperty("question_failed_count") int questionFailedCount,
        boolean ready,
        List<AnswerSttStatus> answers,
        List<QuestionSttStatus> questions
) {
    public record AnswerSttStatus(
            @JsonProperty("answer_id") Long answerId,
            @JsonProperty("question_id") Long questionId,
            @JsonProperty("mentee_id") Long menteeId,
            @JsonProperty("stt_status") SttStatus sttStatus
    ) {
        public static AnswerSttStatus from(InterviewAnswer answer) {
            return new AnswerSttStatus(
                    answer.getId(),
                    answer.getInterviewQuestion().getId(),
                    answer.getMember().getId(),
                    answer.getSttStatus()
            );
        }
    }

    public record QuestionSttStatus(
            @JsonProperty("question_id") Long questionId,
            @JsonProperty("stt_status") SttStatus sttStatus
    ) {
        public static QuestionSttStatus from(InterviewQuestion question) {
            return new QuestionSttStatus(
                    question.getId(),
                    question.getSttStatus()
            );
        }
    }
}
