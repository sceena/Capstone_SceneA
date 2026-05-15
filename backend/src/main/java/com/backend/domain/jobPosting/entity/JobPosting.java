package com.backend.domain.jobPosting.entity;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "job_posting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class JobPosting extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private InterviewSession interviewSession;

    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String jobCategory;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rawText;

    private String url;

    @Builder
    public JobPosting(InterviewSession interviewSession, String company, String jobCategory, String rawText, String url) {
        this.interviewSession = interviewSession;
        this.company = company;
        this.jobCategory = jobCategory;
        this.rawText = rawText;
        this.url = url;
    }
}
