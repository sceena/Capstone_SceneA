package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.request.AiReportRequest;
import com.backend.domain.ai.dto.response.AiReportResponse;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class FastApiAiReportClient implements AiReportClient {

    private final RestClient restClient;

    public FastApiAiReportClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.server.base-url:http://localhost:8000}") String baseUrl) {
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .build();
    }

    @Override
    public AiReportResponse generateReport(AiReportRequest request) {
        try {
            AiReportResponse response = restClient.post()
                    .uri("/report")
                    .body(request)
                    .retrieve()
                    .body(AiReportResponse.class);

            if (response == null) {
                throw new CustomException(ErrorCode.AI_SERVER_ERROR);
            }
            return response;
        } catch (RestClientException e) {
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }
    }
}
