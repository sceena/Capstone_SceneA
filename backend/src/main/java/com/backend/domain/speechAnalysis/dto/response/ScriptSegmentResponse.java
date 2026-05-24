package com.backend.domain.speechAnalysis.dto.response;

import com.backend.domain.speechAnalysis.entity.ScriptSegment;
import com.fasterxml.jackson.annotation.JsonProperty;

public record ScriptSegmentResponse(
        Long id,
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("segment_text") String segmentText,
        @JsonProperty("segment_type") String segmentType,
        @JsonProperty("order_index") int orderIndex
) {
    public static ScriptSegmentResponse from(ScriptSegment segment) {
        return new ScriptSegmentResponse(
                segment.getId(),
                segment.getSpeechAnalysis().getInterviewAnswer().getId(),
                segment.getContent(),
                segment.getSegmentType().name().toLowerCase(),
                segment.getOrderIndex()
        );
    }
}
