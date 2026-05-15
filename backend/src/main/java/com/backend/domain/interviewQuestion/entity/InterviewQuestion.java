package com.backend.domain.interviewQuestion.entity;

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

    @Builder
    public InterviewQuestion(InterviewSession interviewSession, String content, int orderIndex) {
        this.interviewSession = interviewSession;
        this.content = content;
        this.orderIndex = orderIndex;
    }

    public void update(String content) {
        this.content = content;
    }
}
