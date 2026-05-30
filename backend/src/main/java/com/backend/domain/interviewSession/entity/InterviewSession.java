package com.backend.domain.interviewSession.entity;

import com.backend.domain.member.entity.Member;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_session")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentor_id", nullable = false)
    private Member mentor;

    private String jobCategory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.SCHEDULED;

    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    @Builder
    public InterviewSession(Member mentor, String jobCategory, LocalDateTime scheduledAt) {
        this.mentor = mentor;
        this.jobCategory = jobCategory;
        this.scheduledAt = scheduledAt;
    }

    public void progressStatus() {
        if (this.status == SessionStatus.SCHEDULED) {
            start();
        } else if (this.status == SessionStatus.IN_PROGRESS) {
            complete();
        } else {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
    }

    public void start() {
        if (this.status == SessionStatus.IN_PROGRESS) {
            return;
        }
        if (this.status != SessionStatus.SCHEDULED) {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
        this.status = SessionStatus.IN_PROGRESS;
        if (this.startedAt == null) {
            this.startedAt = LocalDateTime.now();
        }
    }

    public void complete() {
        if (this.status == SessionStatus.COMPLETED) {
            return;
        }
        if (this.status != SessionStatus.IN_PROGRESS) {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
        this.status = SessionStatus.COMPLETED;
        if (this.endedAt == null) {
            this.endedAt = LocalDateTime.now();
        }
    }

    public void markPending() {
        this.status = SessionStatus.PENDING;
    }

    public void confirmSchedule(LocalDateTime scheduledAt) {
        this.status = SessionStatus.SCHEDULED;
        this.scheduledAt = scheduledAt;
    }

    public void reschedule(LocalDateTime scheduledAt) {
        this.scheduledAt = scheduledAt;
    }
}
