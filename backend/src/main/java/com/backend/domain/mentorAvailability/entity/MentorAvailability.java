package com.backend.domain.mentorAvailability.entity;

import com.backend.domain.member.entity.Member;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "mentor_availability")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MentorAvailability extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentor_id", nullable = false)
    private Member mentor;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private boolean isBooked = false;

    @Column(nullable = false)
    private int maxParticipants = 1;

    @Builder
    public MentorAvailability(Member mentor, LocalDateTime startTime, LocalDateTime endTime, Integer maxParticipants) {
        this.mentor = mentor;
        this.startTime = startTime;
        this.endTime = endTime;
        this.maxParticipants = maxParticipants == null ? 1 : maxParticipants;
    }

    public void book() {
        this.isBooked = true;
    }

    public void unbook() {
        this.isBooked = false;
    }

    public void reschedule(LocalDateTime startTime, LocalDateTime endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
    }
}
