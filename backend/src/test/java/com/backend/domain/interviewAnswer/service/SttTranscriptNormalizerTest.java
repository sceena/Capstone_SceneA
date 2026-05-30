package com.backend.domain.interviewAnswer.service;

import com.backend.domain.ai.client.SttTranscriptNormalizer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SttTranscriptNormalizerTest {

    private final SttTranscriptNormalizer normalizer = new SttTranscriptNormalizer();

    @Test
    void IT_용어를_표준_표기로_보정한다() {
        String normalized = normalizer.normalize("제이피에이 엔 플러스 원 문제를 레디스 캐시와 도커 배포로 개선했습니다.");

        assertThat(normalized).isEqualTo("JPA N+1 문제를 Redis 캐시와 Docker 배포로 개선했습니다.");
    }

    @Test
    void 공백을_정리하고_CICD_표기를_보정한다() {
        String normalized = normalizer.normalize("씨아이씨디   파이프라인에서   쿠버네티즈 배포를 자동화했습니다.");

        assertThat(normalized).isEqualTo("CI/CD 파이프라인에서 Kubernetes 배포를 자동화했습니다.");
    }
}
