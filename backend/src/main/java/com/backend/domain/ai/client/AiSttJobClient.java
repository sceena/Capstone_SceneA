package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.request.AiSttJobRequest;
import com.backend.domain.ai.dto.response.AiSttJobResponse;

public interface AiSttJobClient {

    AiSttJobResponse submitJob(AiSttJobRequest request);
}
