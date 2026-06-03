package com.backend.domain.analysisReport.entity;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.member.entity.Member;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "mentee_report_feedback",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_mentee_report_feedback_session_mentee",
                columnNames = {"session_id", "mentee_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MenteeReportFeedback extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession interviewSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentee_id", nullable = false)
    private Member mentee;

    @Column(columnDefinition = "TEXT")
    private String mentorFeedback;

    private Float mentorScore;

    @Column(columnDefinition = "TEXT")
    private String mentorQuestionFeedbacksJson;

    @Builder
    public MenteeReportFeedback(InterviewSession interviewSession, Member mentee) {
        this.interviewSession = interviewSession;
        this.mentee = mentee;
    }

    public void updateFinal(String mentorFeedback, Float mentorScore) {
        updateFinal(mentorFeedback, mentorScore, null);
    }

    public void updateFinal(String mentorFeedback, Float mentorScore, String mentorQuestionFeedbacksJson) {
        this.mentorFeedback = mentorFeedback;
        this.mentorScore = mentorScore;
        this.mentorQuestionFeedbacksJson = mentorQuestionFeedbacksJson;
    }
}
