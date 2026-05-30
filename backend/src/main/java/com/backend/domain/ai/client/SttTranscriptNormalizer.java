package com.backend.domain.ai.client;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class SttTranscriptNormalizer {

    private static final Map<String, String> IT_TERMS = new LinkedHashMap<>();

    static {
        IT_TERMS.put("제이피에이", "JPA");
        IT_TERMS.put("제이 피 에이", "JPA");
        IT_TERMS.put("레디스", "Redis");
        IT_TERMS.put("래디스", "Redis");
        IT_TERMS.put("도커", "Docker");
        IT_TERMS.put("쿠버네티스", "Kubernetes");
        IT_TERMS.put("쿠버네티즈", "Kubernetes");
        IT_TERMS.put("스프링 부트", "Spring Boot");
        IT_TERMS.put("스프링부트", "Spring Boot");
        IT_TERMS.put("스프링", "Spring");
        IT_TERMS.put("마이 에스큐엘", "MySQL");
        IT_TERMS.put("마이에스큐엘", "MySQL");
        IT_TERMS.put("포스트그레스큐엘", "PostgreSQL");
        IT_TERMS.put("포스트그레SQL", "PostgreSQL");
        IT_TERMS.put("제이더블유티", "JWT");
        IT_TERMS.put("제이 더블유 티", "JWT");
        IT_TERMS.put("씨아이씨디", "CI/CD");
        IT_TERMS.put("씨아이 씨디", "CI/CD");
        IT_TERMS.put("엔 플러스 원", "N+1");
        IT_TERMS.put("엔플러스원", "N+1");
        IT_TERMS.put("엔 플러스원", "N+1");
        IT_TERMS.put("오알엠", "ORM");
        IT_TERMS.put("오 알 엠", "ORM");
        IT_TERMS.put("에이피아이", "API");
        IT_TERMS.put("에이 피 아이", "API");
        IT_TERMS.put("레스트 에이피아이", "REST API");
        IT_TERMS.put("레스트 API", "REST API");
        IT_TERMS.put("엠에스에이", "MSA");
        IT_TERMS.put("엠 에스 에이", "MSA");
        IT_TERMS.put("로드 밸런서", "로드밸런서");
        IT_TERMS.put("깃허브 액션", "GitHub Actions");
        IT_TERMS.put("깃 허브 액션", "GitHub Actions");
    }

    public String normalize(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return transcript;
        }

        String normalized = transcript;
        for (Map.Entry<String, String> entry : IT_TERMS.entrySet()) {
            normalized = normalized.replace(entry.getKey(), entry.getValue());
        }
        return normalizeSpacing(normalized);
    }

    private String normalizeSpacing(String text) {
        return text
                .replaceAll("\\s+", " ")
                .replace("CI / CD", "CI/CD")
                .replace("N + 1", "N+1")
                .trim();
    }
}
