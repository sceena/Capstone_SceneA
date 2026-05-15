package com.backend.domain.speechAnalysis.repository;

import com.backend.domain.speechAnalysis.entity.ScriptSegment;
import com.backend.domain.speechAnalysis.entity.SpeechAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScriptSegmentRepository extends JpaRepository<ScriptSegment, Long> {

    List<ScriptSegment> findAllBySpeechAnalysisOrderByOrderIndex(SpeechAnalysis speechAnalysis);
}
