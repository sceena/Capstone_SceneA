package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.response.AiSttResponse;
import org.springframework.web.multipart.MultipartFile;

public interface AiSttClient {

    AiSttResponse transcribe(MultipartFile audio);
}
