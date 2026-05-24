package com.backend.domain.speechAnalysis.dto.response;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.speechAnalysis.entity.SpeechAnalysis;
import com.fasterxml.jackson.annotation.JsonProperty;

public record SpeechAnalysisResponse(
        @JsonProperty("answer_id") Long answerId,
        @JsonProperty("stt_text") String sttText,
        Float wpm,
        @JsonProperty("dead_air_count") Integer deadAirCount,
        @JsonProperty("response_delay_sec") Float responseDelaySec,
        @JsonProperty("avg_words_per_sentence") Float avgWordsPerSentence,
        @JsonProperty("is_star_s") Boolean isStarS,
        @JsonProperty("is_star_t") Boolean isStarT,
        @JsonProperty("is_star_a") Boolean isStarA,
        @JsonProperty("is_star_r") Boolean isStarR,
        @JsonProperty("star_ratio") Float starRatio,
        @JsonProperty("ai_score") Float aiScore
) {
    public static SpeechAnalysisResponse from(InterviewAnswer answer, SpeechAnalysis analysis) {
        return new SpeechAnalysisResponse(
                answer.getId(),
                answer.getSttText(),
                analysis.getWpm(),
                analysis.getDeadAirCount(),
                analysis.getResponseDelaySec(),
                analysis.getAvgWordsPerSentence(),
                analysis.getIsStarS(),
                analysis.getIsStarT(),
                analysis.getIsStarA(),
                analysis.getIsStarR(),
                analysis.getStarRatio(),
                answer.getAiScore()
        );
    }
}
