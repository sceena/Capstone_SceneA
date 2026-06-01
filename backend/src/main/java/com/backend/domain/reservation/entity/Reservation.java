package com.backend.domain.reservation.entity;

import com.backend.domain.member.entity.Member;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "reservation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Reservation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "availability_id", nullable = false)
    private MentorAvailability mentorAvailability;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentee_id", nullable = false)
    private Member mentee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private InterviewSession interviewSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status = ReservationStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String resumeContent;

    @Column(columnDefinition = "TEXT")
    private String requestNote;

    @Builder
    public Reservation(MentorAvailability mentorAvailability, Member mentee, InterviewSession interviewSession, String resumeContent, String requestNote) {
        this.mentorAvailability = mentorAvailability;
        this.mentee = mentee;
        this.interviewSession = interviewSession;
        this.resumeContent = resumeContent;
        this.requestNote = requestNote;
    }

    public void confirm() {
        this.status = ReservationStatus.CONFIRMED;
    }

    public void linkSession(InterviewSession session) {
        this.interviewSession = session;
    }

    public void cancel() {
        this.status = ReservationStatus.CANCELLED;
    }
}
