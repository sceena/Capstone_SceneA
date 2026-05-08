package com.backend.domain.interviewQuestion.dto.request;

import java.util.List;

public record QuestionCreateRequest(
        List<QuestionItem> questions
) {
    public record QuestionItem(
            String content
    ) {}
}
