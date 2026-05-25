package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.request.AiSttJobRequest;
import com.backend.domain.ai.dto.response.AiSttJobResponse;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
@Slf4j
public class FastApiAiSttJobClient implements AiSttJobClient {

    private final RestClient restClient;

    public FastApiAiSttJobClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.server.base-url:http://localhost:8000}") String baseUrl) {
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .requestFactory(new SimpleClientHttpRequestFactory())
                .build();
    }

    @Override
    public AiSttJobResponse submitJob(AiSttJobRequest request) {
        try {
            AiSttJobResponse response = restClient.post()
                    .uri("/api/stt/jobs")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiSttJobResponse.class);

            if (response == null) {
                throw new CustomException(ErrorCode.AI_SERVER_ERROR);
            }
            return response;
        } catch (RestClientResponseException e) {
            log.warn("AI STT job server returned {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        } catch (RestClientException e) {
            log.warn("AI STT job server request failed", e);
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }
    }
}
