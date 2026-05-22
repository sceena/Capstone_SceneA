package com.backend.global.config;

import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${cloud.aws.s3.endpoint:}")
    private String endpoint;

    @Value("${cloud.aws.region.static}")
    private String region;

    public String uploadProfileImage(Long memberId, MultipartFile file) {
        if (file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            throw new CustomException(ErrorCode.INVALID_FILE);
        }

        String key = "profile-images/" + memberId + "/" + UUID.randomUUID() + getExtension(file);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        return buildUrl(key);
    }

    private String getExtension(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf("."));
        }
        return "";
    }

    public void deleteFile(String fileUrl) {
        String key = extractKey(fileUrl);
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
    }

    private String extractKey(String fileUrl) {
        // dev:  http://localhost:9000/{bucket}/{key}
        // prod: https://{bucket}.s3.{region}.amazonaws.com/{key}
        String marker = "/" + bucket + "/";
        int idx = fileUrl.indexOf(marker);
        return fileUrl.substring(idx + marker.length());
    }

    private String buildUrl(String key) {
        if (!endpoint.isEmpty()) {
            return endpoint + "/" + bucket + "/" + key;
        }
        return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
    }
}
