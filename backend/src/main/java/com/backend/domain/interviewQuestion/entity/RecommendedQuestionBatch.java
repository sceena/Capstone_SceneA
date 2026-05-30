package com.backend.domain.interviewQuestion.entity;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recommended_question_batch")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendedQuestionBatch extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private InterviewSession interviewSession;

    @Column(nullable = false)
    private String sessionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecommendedQuestionStatus status;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Builder
    public RecommendedQuestionBatch(InterviewSession interviewSession, String sessionType) {
        this.interviewSession = interviewSession;
        this.sessionType = sessionType;
        this.status = RecommendedQuestionStatus.PENDING;
    }

    public void markPending(String sessionType) {
        this.sessionType = sessionType;
        this.status = RecommendedQuestionStatus.PENDING;
        this.errorMessage = null;
    }

    public void markCompleted(String sessionType) {
        this.sessionType = sessionType;
        this.status = RecommendedQuestionStatus.COMPLETED;
        this.errorMessage = null;
    }

    public void markFailed(String errorMessage) {
        this.status = RecommendedQuestionStatus.FAILED;
        this.errorMessage = errorMessage;
    }
}
