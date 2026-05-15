package com.backend.domain.interviewSession.entity;

import com.backend.domain.member.entity.Member;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "session_participant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SessionParticipant extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession interviewSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    private AnswerStatus answerStatus;

    @Builder
    public SessionParticipant(InterviewSession interviewSession, Member member, AnswerStatus answerStatus) {
        this.interviewSession = interviewSession;
        this.member = member;
        this.answerStatus = answerStatus;
    }

    public void updateAnswerStatus(AnswerStatus answerStatus) {
        this.answerStatus = answerStatus;
    }
}
