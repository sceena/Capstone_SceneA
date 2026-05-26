package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.request.AiSessionQuestionGenerationRequest;
import com.backend.domain.ai.dto.response.AiSessionQuestionGenerationResponse;

public interface AiQuestionGenerationClient {

    AiSessionQuestionGenerationResponse generateSessionQuestions(AiSessionQuestionGenerationRequest request);
}
