package com.backend.domain.speechAnalysis.entity;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "speech_analysis")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SpeechAnalysis extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answer_id", nullable = false, unique = true)
    private InterviewAnswer interviewAnswer;

    private Float wpm;

    private Integer deadAirCount;

    private Float responseDelaySec;

    private Float avgWordsPerSentence;

    private Boolean isStarS;

    private Boolean isStarT;

    private Boolean isStarA;

    private Boolean isStarR;

    private Float starRatio;

    @Builder
    public SpeechAnalysis(InterviewAnswer interviewAnswer, Float wpm, Integer deadAirCount,
                          Float responseDelaySec, Float avgWordsPerSentence,
                          Boolean isStarS, Boolean isStarT, Boolean isStarA, Boolean isStarR,
                          Float starRatio) {
        this.interviewAnswer = interviewAnswer;
        this.wpm = wpm;
        this.deadAirCount = deadAirCount;
        this.responseDelaySec = responseDelaySec;
        this.avgWordsPerSentence = avgWordsPerSentence;
        this.isStarS = isStarS;
        this.isStarT = isStarT;
        this.isStarA = isStarA;
        this.isStarR = isStarR;
        this.starRatio = starRatio;
    }
}
