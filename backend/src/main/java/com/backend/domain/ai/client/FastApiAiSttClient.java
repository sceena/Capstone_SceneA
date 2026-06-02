package com.backend.domain.ai.client;

import com.backend.domain.ai.dto.response.AiSttResponse;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;

import java.io.IOException;
import java.time.Duration;

@Component
@Slf4j
public class FastApiAiSttClient implements AiSttClient {

    private final RestClient restClient;
    private final String baseUrl;

    public FastApiAiSttClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.server.base-url:http://localhost:8000}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(180));

        this.baseUrl = baseUrl;
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        log.info("AI STT client configured with baseUrl={}", baseUrl);
    }

    @Override
    public AiSttResponse transcribe(MultipartFile audio) {
        try {
            log.info(
                    "Requesting AI STT /api/stt baseUrl={} filename={} size={}",
                    baseUrl,
                    resolveFilename(audio),
                    audio.getSize()
            );
            AiSttResponse response = restClient.post()
                    .uri("/api/stt")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(toMultipartBody(audio))
                    .retrieve()
                    .body(AiSttResponse.class);

            if (response == null) {
                throw new CustomException(ErrorCode.AI_SERVER_ERROR);
            }
            return response;
        } catch (RestClientResponseException e) {
            log.warn("AI STT server returned {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        } catch (RestClientException | IOException e) {
            log.warn("AI STT server request failed", e);
            throw new CustomException(ErrorCode.AI_SERVER_ERROR);
        }
    }

    private MultiValueMap<String, Object> toMultipartBody(MultipartFile audio) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(resolveContentType(audio));

        HttpEntity<ByteArrayResource> audioPart = new HttpEntity<>(
                new NamedByteArrayResource(audio.getBytes(), resolveFilename(audio)),
                headers
        );

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("audio", audioPart);
        return body;
    }

    private MediaType resolveContentType(MultipartFile audio) {
        String contentType = audio.getContentType();
        if (!StringUtils.hasText(contentType)) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        return MediaType.parseMediaType(contentType);
    }

    private String resolveFilename(MultipartFile audio) {
        String filename = audio.getOriginalFilename();
        return StringUtils.hasText(filename) ? filename : "answer.wav";
    }

    private static class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(byte[] byteArray, String filename) {
            super(byteArray);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
