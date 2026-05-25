package com.backend.domain.interviewAnswer.dto.response;

import com.backend.domain.interviewAnswer.entity.AudioQualityStatus;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record AnswerUploadResponse(
        Long id,
        @JsonProperty("session_id") Long sessionId,
        @JsonProperty("question_id") Long questionId,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("answer_start") LocalDateTime answerStart,
        @JsonProperty("answer_end") LocalDateTime answerEnd,
        @JsonProperty("stt_text") String sttText,
        @JsonProperty("stt_status") SttStatus sttStatus,
        @JsonProperty("audio_quality_status") AudioQualityStatus audioQualityStatus,
        @JsonProperty("audio_quality_message") String audioQualityMessage,
        @JsonProperty("ai_score") Float aiScore,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("created_at") LocalDateTime createdAt
) {
    public static AnswerUploadResponse from(InterviewAnswer answer, Long sessionId) {
        return new AnswerUploadResponse(
                answer.getId(),
                sessionId,
                answer.getInterviewQuestion().getId(),
                answer.getMember().getId(),
                answer.getAnswerStart(),
                answer.getAnswerEnd(),
                answer.getSttText(),
                answer.getSttStatus(),
                answer.getAudioQualityStatus(),
                answer.getAudioQualityMessage(),
                answer.getAiScore(),
                answer.getMentorScore(),
                answer.getCreateDate()
        );
    }
}
