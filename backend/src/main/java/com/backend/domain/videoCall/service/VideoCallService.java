package com.backend.domain.videoCall.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.videoCall.dto.response.VideoTokenResponse;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class VideoCallService {

    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;
    private final String apiKey;
    private final SecretKey apiSecretKey;
    private final String livekitUrl;

    public VideoCallService(
            InterviewSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            MemberRepository memberRepository,
            @Value("${livekit.api-key}") String apiKey,
            @Value("${livekit.api-secret}") String apiSecret,
            @Value("${livekit.url}") String livekitUrl) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.memberRepository = memberRepository;
        this.apiKey = apiKey;
        this.apiSecretKey = Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8));
        this.livekitUrl = livekitUrl;
    }

    public VideoTokenResponse getToken(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        if (session.getStatus() == SessionStatus.COMPLETED) {
            throw new CustomException(ErrorCode.SESSION_NOT_JOINABLE);
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        boolean isMentor = session.getMentor().getId().equals(memberId);
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session, member)
                .isPresent();

        if (!isMentor && !isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        String roomName = "session-" + sessionId;
        String token = buildToken(roomName, String.valueOf(memberId), member.getNickname());

        return new VideoTokenResponse(token, roomName, livekitUrl);
    }

    private String buildToken(String roomName, String identity, String displayName) {
        Map<String, Object> videoGrant = new LinkedHashMap<>();
        videoGrant.put("room", roomName);
        videoGrant.put("roomJoin", true);
        videoGrant.put("canPublish", true);
        videoGrant.put("canSubscribe", true);
        videoGrant.put("canPublishData", true);

        Date now = new Date();
        return Jwts.builder()
                .issuer(apiKey)
                .subject(identity)
                .id(UUID.randomUUID().toString())
                .notBefore(now)
                .expiration(new Date(now.getTime() + 6 * 60 * 60 * 1000L))
                .claim("name", displayName)
                .claim("video", videoGrant)
                .signWith(apiSecretKey)
                .compact();
    }
}
