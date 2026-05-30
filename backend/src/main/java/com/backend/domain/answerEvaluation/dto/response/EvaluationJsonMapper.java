package com.backend.domain.answerEvaluation.dto.response;

import java.util.List;

public interface EvaluationJsonMapper {
    List<String> fromJson(String json);
}
