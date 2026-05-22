package com.backend.domain.analysisReport.entity;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "analysis_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnalysisReport extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private InterviewSession interviewSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus reportStatus = ReportStatus.FIRST;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    @Column(columnDefinition = "TEXT")
    private String mentorFeedback;

    private Float totalScore;

    private Float alignmentScore;

    @Column(columnDefinition = "TEXT")
    private String bestMoment;

    @Column(columnDefinition = "TEXT")
    private String worstMoment;

    @Column(columnDefinition = "TEXT")
    private String rawAiResponseJson;

    @Builder
    public AnalysisReport(InterviewSession interviewSession, String aiSummary,
                          Float totalScore, Float alignmentScore,
                          String bestMoment, String worstMoment, String rawAiResponseJson) {
        this.interviewSession = interviewSession;
        this.aiSummary = aiSummary;
        this.totalScore = totalScore;
        this.alignmentScore = alignmentScore;
        this.bestMoment = bestMoment;
        this.worstMoment = worstMoment;
        this.rawAiResponseJson = rawAiResponseJson;
    }

    public void updateAiReport(String aiSummary, Float totalScore, Float alignmentScore,
                               String bestMoment, String worstMoment, String rawAiResponseJson) {
        this.aiSummary = aiSummary;
        this.totalScore = totalScore;
        this.alignmentScore = alignmentScore;
        this.bestMoment = bestMoment;
        this.worstMoment = worstMoment;
        this.rawAiResponseJson = rawAiResponseJson;
        this.reportStatus = ReportStatus.FIRST;
    }

    public void completeFinal(String mentorFeedback) {
        this.mentorFeedback = mentorFeedback;
        this.reportStatus = ReportStatus.FINAL;
    }
}
