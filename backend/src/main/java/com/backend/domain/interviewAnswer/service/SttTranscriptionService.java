package com.backend.domain.interviewAnswer.service;

import com.backend.domain.ai.client.AiSttClient;
import com.backend.domain.ai.dto.response.AiSttResponse;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class SttTranscriptionService {

    private final InterviewAnswerRepository answerRepository;
    private final S3Client s3Client;
    private final AiSttClient aiSttClient;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Async
    @Transactional
    public void transcribeAnswer(Long answerId) {
        InterviewAnswer answer = answerRepository.findById(answerId).orElse(null);
        if (answer == null) {
            log.warn("STT skipped because answerId={} was not found", answerId);
            return;
        }

        try {
            MultipartFile audio = downloadAudio(answer.getAudioUrl());
            AiSttResponse response = aiSttClient.transcribe(audio);
            answer.completeStt(
                    response.text(),
                    response.model(),
                    response.durationSec(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
            log.info("STT completed for answerId={}", answerId);
        } catch (RuntimeException | IOException e) {
            answer.failStt(e.getMessage());
            log.warn("STT failed for answerId={}: {}", answerId, e.getMessage(), e);
        }
    }

    private MultipartFile downloadAudio(String key) throws IOException {
        ResponseInputStream<GetObjectResponse> object = s3Client.getObject(
                GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .build()
        );
        GetObjectResponse response = object.response();
        byte[] bytes;
        try (object) {
            bytes = object.readAllBytes();
        }
        String filename = resolveFilename(key);
        String contentType = StringUtils.hasText(response.contentType())
                ? response.contentType()
                : "application/octet-stream";
        return new InMemoryMultipartFile("audio", filename, contentType, bytes);
    }

    private String resolveFilename(String key) {
        if (!StringUtils.hasText(key)) {
            return "answer.wav";
        }
        int slashIndex = key.lastIndexOf('/');
        return slashIndex >= 0 ? key.substring(slashIndex + 1) : key;
    }

    private record InMemoryMultipartFile(
            String name,
            String originalFilename,
            String contentType,
            byte[] bytes
    ) implements MultipartFile {

        @Override
        public String getName() {
            return name;
        }

        @Override
        public String getOriginalFilename() {
            return originalFilename;
        }

        @Override
        public String getContentType() {
            return contentType;
        }

        @Override
        public boolean isEmpty() {
            return bytes.length == 0;
        }

        @Override
        public long getSize() {
            return bytes.length;
        }

        @Override
        public byte[] getBytes() {
            return bytes;
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(bytes);
        }

        @Override
        public void transferTo(java.io.File dest) throws IOException, IllegalStateException {
            java.nio.file.Files.write(dest.toPath(), bytes);
        }
    }
}
