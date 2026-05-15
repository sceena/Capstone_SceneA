package com.backend.domain.reservation.entity;

import com.backend.domain.member.entity.Member;
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

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "availability_id", nullable = false, unique = true)
    private MentorAvailability mentorAvailability;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentee_id", nullable = false)
    private Member mentee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status = ReservationStatus.PENDING;

    @Builder
    public Reservation(MentorAvailability mentorAvailability, Member mentee) {
        this.mentorAvailability = mentorAvailability;
        this.mentee = mentee;
    }

    public void confirm() {
        this.status = ReservationStatus.CONFIRMED;
    }

    public void cancel() {
        this.status = ReservationStatus.CANCELLED;
        this.mentorAvailability.unbook();
    }
}
