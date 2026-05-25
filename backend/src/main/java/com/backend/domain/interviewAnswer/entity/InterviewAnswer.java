package com.backend.domain.interviewAnswer.entity;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.member.entity.Member;
import com.backend.global.jpa.BaseEntity;
import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_answer")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewAnswer extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private InterviewQuestion interviewQuestion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private String audioUrl;

    @Column(nullable = false)
    private LocalDateTime answerStart;

    @Column(nullable = false)
    private LocalDateTime answerEnd;

    @Column(columnDefinition = "TEXT")
    private String sttText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SttStatus sttStatus = SttStatus.PENDING;

    private String sttModel;

    private Float durationSec;

    @Enumerated(EnumType.STRING)
    private AudioQualityStatus audioQualityStatus;

    @Column(columnDefinition = "TEXT")
    private String audioQualityMessage;

    @Column(columnDefinition = "TEXT")
    private String sttErrorMessage;

    private Float aiScore;

    private Float mentorScore;

    private Float gap;

    @Builder
    public InterviewAnswer(InterviewQuestion interviewQuestion, Member member, String audioUrl,
                           LocalDateTime answerStart, LocalDateTime answerEnd) {
        this.interviewQuestion = interviewQuestion;
        this.member = member;
        this.audioUrl = audioUrl;
        this.answerStart = answerStart;
        this.answerEnd = answerEnd;
    }

    public void updateAudio(String audioUrl, LocalDateTime answerStart, LocalDateTime answerEnd) {
        this.audioUrl = audioUrl;
        this.answerStart = answerStart;
        this.answerEnd = answerEnd;
    }

    public void updateSttText(String sttText) {
        this.sttText = sttText;
    }

    public void completeStt(String text, String model, Float durationSec,
                            AudioQualityStatus audioQualityStatus, String audioQualityMessage) {
        this.sttText = text;
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

    public void updateSttStatus(SttStatus status) {
        this.sttStatus = status;
    }

    public void updateAiScore(Float aiScore) {
        this.aiScore = aiScore;
    }

    public void updateMentorScore(Float mentorScore) {
        this.mentorScore = mentorScore;
        if (this.aiScore != null) {
            this.gap = Math.abs(this.aiScore - mentorScore);
        }
    }
}
