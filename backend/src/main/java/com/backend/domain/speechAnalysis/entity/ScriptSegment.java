package com.backend.domain.speechAnalysis.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "script_segment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScriptSegment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "speech_analysis_id", nullable = false)
    private SpeechAnalysis speechAnalysis;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SegmentType segmentType;

    @Column(nullable = false)
    private int orderIndex;

    @Builder
    public ScriptSegment(SpeechAnalysis speechAnalysis, String content, SegmentType segmentType, int orderIndex) {
        this.speechAnalysis = speechAnalysis;
        this.content = content;
        this.segmentType = segmentType;
        this.orderIndex = orderIndex;
    }
}
