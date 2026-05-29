package com.backend.domain.answerEvaluation.entity;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "answer_evaluation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnswerEvaluation extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answer_id", nullable = false, unique = true)
    private InterviewAnswer interviewAnswer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Column(columnDefinition = "TEXT")
    private String aiReasoning;

    private Float aiScore;

    @Column(columnDefinition = "TEXT")
    private String aiStrengthsJson;

    @Column(columnDefinition = "TEXT")
    private String aiImprovementsJson;

    @Column(columnDefinition = "TEXT")
    private String mentorReasoning;

    private Float mentorScore;

    @Column(columnDefinition = "TEXT")
    private String mentorStrengthsJson;

    @Column(columnDefinition = "TEXT")
    private String mentorImprovementsJson;

    private String aiModelName;

    private String promptVersion;

    private String evaluationSource;

    @Builder
    public AnswerEvaluation(InterviewAnswer interviewAnswer, String questionText, String answerText) {
        this.interviewAnswer = interviewAnswer;
        this.questionText = questionText;
        this.answerText = answerText;
    }

    public void updateAiDraft(
            String questionText,
            String answerText,
            String aiReasoning,
            Float aiScore,
            String aiStrengthsJson,
            String aiImprovementsJson,
            String aiModelName,
            String promptVersion,
            String evaluationSource
    ) {
        this.questionText = questionText;
        this.answerText = answerText;
        this.aiReasoning = aiReasoning;
        this.aiScore = aiScore;
        this.aiStrengthsJson = aiStrengthsJson;
        this.aiImprovementsJson = aiImprovementsJson;
        this.aiModelName = aiModelName;
        this.promptVersion = promptVersion;
        this.evaluationSource = evaluationSource;
    }

    public void updateMentorEvaluation(
            String mentorReasoning,
            Float mentorScore,
            String mentorStrengthsJson,
            String mentorImprovementsJson
    ) {
        this.mentorReasoning = mentorReasoning;
        this.mentorScore = mentorScore;
        this.mentorStrengthsJson = mentorStrengthsJson;
        this.mentorImprovementsJson = mentorImprovementsJson;
    }
}
