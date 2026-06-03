package com.backend.domain.analysisReport.dto.response;

import com.backend.domain.analysisReport.entity.MenteeReportFeedback;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record MenteeReportFeedbackResponse(
        Long id,
        @JsonProperty("mentee_id") Long menteeId,
        @JsonProperty("mentee_name") String menteeName,
        @JsonProperty("mentor_feedback") String mentorFeedback,
        @JsonProperty("mentor_score") Float mentorScore,
        @JsonProperty("mentor_question_feedbacks") String mentorQuestionFeedbacks,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static MenteeReportFeedbackResponse from(MenteeReportFeedback feedback) {
        return new MenteeReportFeedbackResponse(
                feedback.getId(),
                feedback.getMentee().getId(),
                feedback.getMentee().getName(),
                feedback.getMentorFeedback(),
                feedback.getMentorScore(),
                feedback.getMentorQuestionFeedbacksJson(),
                feedback.getModifyDate()
        );
    }
}
