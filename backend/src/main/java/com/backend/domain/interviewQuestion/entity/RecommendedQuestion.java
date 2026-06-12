package com.backend.domain.interviewQuestion.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recommended_question")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendedQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private RecommendedQuestionBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecommendedQuestionType type;

    private Long candidateId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private int orderIndex;

    @Builder
    public RecommendedQuestion(
            RecommendedQuestionBatch batch,
            RecommendedQuestionType type,
            Long candidateId,
            String content,
            int orderIndex) {
        this.batch = batch;
        this.type = type;
        this.candidateId = candidateId;
        this.content = content;
        this.orderIndex = orderIndex;
    }
}
