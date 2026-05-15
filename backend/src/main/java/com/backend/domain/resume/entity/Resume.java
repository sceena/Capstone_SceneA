package com.backend.domain.resume.entity;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.member.entity.Member;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "resume")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Resume extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession interviewSession;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Builder
    public Resume(Member member, InterviewSession interviewSession, String content) {
        this.member = member;
        this.interviewSession = interviewSession;
        this.content = content;
    }
}
