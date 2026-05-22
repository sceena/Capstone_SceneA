package com.backend.domain.ai.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiCandidateContext(
        @JsonProperty("candidate_id") Long candidateId,
        String name,
        String level,
        @JsonProperty("target_role") String targetRole,
        @JsonProperty("resume_summaries") List<String> resumeSummaries
) {
}
