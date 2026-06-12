package com.backend.domain.interviewQuestion.entity;

import com.backend.domain.interviewAnswer.entity.AudioQualityStatus;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_question")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession interviewSession;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private int orderIndex;

    private String questionType;

    private Long candidateId;

    private String audioUrl;

    @Enumerated(EnumType.STRING)
    private SttStatus sttStatus;

    private String sttModel;

    private Float durationSec;

    @Enumerated(EnumType.STRING)
    private AudioQualityStatus audioQualityStatus;

    @Column(columnDefinition = "TEXT")
    private String audioQualityMessage;

    @Column(columnDefinition = "TEXT")
    private String sttErrorMessage;

    @Builder
    public InterviewQuestion(InterviewSession interviewSession, String content, int orderIndex, String questionType, Long candidateId) {
        this.interviewSession = interviewSession;
        this.content = content;
        this.orderIndex = orderIndex;
        this.questionType = questionType;
        this.candidateId = candidateId;
    }

    public void update(String content) {
        this.content = content;
    }

    public void updateAudio(String audioUrl) {
        this.audioUrl = audioUrl;
        this.sttStatus = SttStatus.PENDING;
        this.sttErrorMessage = null;
    }

    public void updateSttStatus(SttStatus sttStatus) {
        this.sttStatus = sttStatus;
    }

    public void completeStt(String text, String model, Float durationSec,
                            AudioQualityStatus audioQualityStatus, String audioQualityMessage) {
        this.content = (text == null || text.isBlank()) ? this.content : text;
        this.sttStatus = SttStatus.COMPLETED;
        this.sttModel = model;
        this.durationSec = durationSec;
        this.audioQualityStatus = audioQualityStatus;
        this.audioQualityMessage = audioQualityMessage;
    }

    public void failStt(String errorMessage) {
        this.sttStatus = SttStatus.FAILED;
        this.sttErrorMessage = errorMessage;
    }
}
