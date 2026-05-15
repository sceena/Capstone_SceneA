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

    @Builder
    public MentorAvailability(Member mentor, LocalDateTime startTime, LocalDateTime endTime) {
        this.mentor = mentor;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public void book() {
        this.isBooked = true;
    }

    public void unbook() {
        this.isBooked = false;
    }
}
