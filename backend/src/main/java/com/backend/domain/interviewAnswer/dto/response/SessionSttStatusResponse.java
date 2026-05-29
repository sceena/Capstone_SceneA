package com.backend.domain.interviewAnswer.dto.response;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record SessionSttStatusResponse(
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("total_count") int totalCount,
        @JsonProperty("completed_count") int completedCount,
        @JsonProperty("pending_count") int pendingCount,
        @JsonProperty("processing_count") int processingCount,
        @JsonProperty("failed_count") int failedCount,
        boolean ready,
        List<AnswerSttStatus> answers
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
}
