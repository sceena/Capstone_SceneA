package com.backend.domain.interviewQuestion.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record QuestionCreateRequest(
        List<QuestionItem> questions
) {
    public record QuestionItem(
            String content,
            @JsonProperty("question_type")
            @JsonAlias("questionType")
            String questionType,
            @JsonProperty("candidate_id")
            @JsonAlias("candidateId")
            Long candidateId
    ) {
        public QuestionItem(String content) {
            this(content, null, null);
        }
    }
}
