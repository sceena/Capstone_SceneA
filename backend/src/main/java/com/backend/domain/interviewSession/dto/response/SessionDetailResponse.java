package com.backend.domain.interviewSession.dto.response;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public record SessionDetailResponse(
        Long id,
        String title,
        @JsonProperty("job_category") String jobCategory,
        @JsonProperty("session_type") String sessionType,
        SessionStatus status,
        @JsonProperty("scheduled_at") LocalDateTime scheduledAt,
        @JsonProperty("started_at") LocalDateTime startedAt,
        @JsonProperty("ended_at") LocalDateTime endedAt,
        @JsonProperty("mentor_id") Long mentorId,
        @JsonProperty("mentor_name") String mentorName,
        @JsonProperty("mentee_name") String menteeName,
        @JsonProperty("mentor_info") String mentorInfo,
        @JsonProperty("mentee_goal") String menteeGoal,
        @JsonProperty("ai_report") String aiReport,
        List<ParticipantInfo> participants,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt
) {
    public static SessionDetailResponse of(
            InterviewSession session,
            List<ParticipantInfo> participants,
            String sessionType
    ) {
        String title = session.getJobCategory() != null && !session.getJobCategory().isBlank()
                ? session.getJobCategory() + " 모의 면접"
                : "모의 면접";
        String menteeName = participants.stream()
                .filter(p -> "mentee".equals(p.role()))
                .map(ParticipantInfo::name)
                .findFirst()
                .orElse("");
        String mentorInfo = session.getMentor().getBio() != null
                ? session.getMentor().getBio()
                : "면접 준비를 함께 진행합니다.";
        return new SessionDetailResponse(
                session.getId(),
                title,
                session.getJobCategory(),
                sessionType,
                session.getStatus(),
                session.getScheduledAt(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getMentor().getId(),
                session.getMentor().getName(),
                menteeName,
                mentorInfo,
                "멘토에게 전달한 자기소개서와 지원 정보를 바탕으로 면접을 준비합니다.",
                "자기소개서와 지원 정보를 기반으로 맞춤 질문을 확인할 수 있습니다.",
                participants,
                session.getCreateDate(),
                session.getModifyDate()
        );
    }
}
