package com.backend.domain.interviewSession.service;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.entity.ReportStatus;
import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewSession.dto.request.ParticipantStatusRequest;
import com.backend.domain.interviewSession.dto.request.SessionCreateRequest;
import com.backend.domain.interviewSession.dto.request.SessionStatusRequest;
import com.backend.domain.interviewSession.dto.response.*;
import com.backend.domain.interviewSession.dto.response.ParticipantStatusResponse;
import com.backend.domain.interviewSession.entity.*;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.repository.ReservationRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SessionService {

    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ReservationRepository reservationRepository;
    private final MemberRepository memberRepository;
    private final AnalysisReportRepository reportRepository;

    @Transactional
    public SessionCreateResponse createSession(Long mentorId, SessionCreateRequest request) {
        Member requester = memberRepository.findById(mentorId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        Member mentor = requester;
        if (request.mentorId() != null && requester.getRole() == Role.MENTEE) {
            mentor = memberRepository.findById(request.mentorId())
                    .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
            if (mentor.getRole() != Role.MENTOR) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
        }

        InterviewSession session = InterviewSession.builder()
                .mentor(mentor)
                .jobCategory(request.jobCategory())
                .scheduledAt(java.time.LocalDateTime.now())
                .build();

        InterviewSession savedSession = sessionRepository.save(session);

        if (requester.getRole() == Role.MENTEE) {
            SessionParticipant participant = SessionParticipant.builder()
                    .interviewSession(savedSession)
                    .member(requester)
                    .answerStatus(AnswerStatus.WAITING)
                    .build();
            participantRepository.save(participant);
        }

        return SessionCreateResponse.from(savedSession);
    }

    public SessionDetailResponse getSession(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        validateSessionAccess(memberId, session);

        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session);

        List<ParticipantInfo> participantInfos = participants.stream()
                .map(p -> {
                    String role = p.getMember().getId().equals(session.getMentor().getId()) ? "mentor" : "mentee";
                    return ParticipantInfo.of(p, role);
                })
                .toList();

        return SessionDetailResponse.of(session, participantInfos, resolveSessionType(session, participants));
    }

    public SessionListResponse getMySessions(Long memberId, String status, Pageable pageable) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        SessionStatus sessionStatus = status != null
                ? SessionStatus.valueOf(status.toUpperCase())
                : null;

        Page<SessionSummaryResponse> page;

        if (member.getRole() == Role.MENTOR) {
            page = sessionStatus != null
                    ? sessionRepository.findAllByMentorAndStatus(member, sessionStatus, pageable).map(this::toSummary)
                    : sessionRepository.findAllByMentor(member, pageable).map(this::toSummary);
            return SessionListResponse.from(page);
        } else {
            // 멘티: 참여자 목록 + 확정된 예약의 세션 합산
            List<InterviewSession> participantSessions = participantRepository.findAllByMember(member)
                    .stream().map(SessionParticipant::getInterviewSession).toList();

            List<InterviewSession> reservationSessions = reservationRepository.findAllByMentee(member)
                    .stream()
                    .filter(r -> r.getStatus() == ReservationStatus.CONFIRMED)
                    .map(Reservation::getInterviewSession)
                    .filter(s -> s != null)
                    .toList();

            List<SessionSummaryResponse> all = java.util.stream.Stream
                    .concat(participantSessions.stream(), reservationSessions.stream())
                    .distinct()
                    .filter(s -> sessionStatus == null || s.getStatus() == sessionStatus)
                    .map(this::toSummary)
                    .toList();

            return new SessionListResponse(all, 0, all.size(), all.size(), 1);
        }
    }

    private SessionSummaryResponse toSummary(InterviewSession session) {
        List<SessionParticipant> participants = participantRepository.findAllByInterviewSession(session);
        AnalysisReport report = reportRepository
                .findFirstByInterviewSessionAndReportStatusOrderByCreateDateDesc(session, ReportStatus.FINAL)
                .orElseGet(() -> reportRepository
                        .findFirstByInterviewSessionAndReportStatusOrderByCreateDateDesc(session, ReportStatus.FIRST)
                        .orElse(null));
        return SessionSummaryResponse.from(
                session,
                participants,
                resolveSessionType(session, participants),
                report != null ? report.getReportStatus().name().toLowerCase() : null,
                report != null ? report.getTotalScore() : null
        );
    }

    private String resolveSessionType(InterviewSession session, List<SessionParticipant> participants) {
        boolean groupReservation = reservationRepository.findAllByInterviewSession(session).stream()
                .anyMatch(r -> r.getMentorAvailability().getMaxParticipants() > 1);
        long menteeCount = participants.stream()
                .filter(p -> !p.getMember().getId().equals(session.getMentor().getId()))
                .count();
        return groupReservation || menteeCount > 1 ? "그룹 면접" : "1:1 면접";
    }

    @Transactional
    public SessionStatusResponse updateSessionStatus(Long mentorId, Long sessionId, SessionStatusRequest request) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        if (!session.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        SessionStatus requestedStatus = parseSessionStatus(request.status());
        if (requestedStatus == SessionStatus.IN_PROGRESS) {
            session.start();
        } else if (requestedStatus == SessionStatus.COMPLETED) {
            session.complete();
        } else {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }

        return SessionStatusResponse.from(session);
    }

    @Transactional
    public SessionJoinResponse joinSession(Long memberId, Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        Optional<SessionParticipant> existing = participantRepository.findByInterviewSessionAndMember(session, member);
        if (existing.isPresent()) {
            return SessionJoinResponse.from(existing.get());
        }

        AnswerStatus answerStatus = member.getRole() == Role.MENTEE ? AnswerStatus.WAITING : null;

        SessionParticipant participant = SessionParticipant.builder()
                .interviewSession(session)
                .member(member)
                .answerStatus(answerStatus)
                .build();

        return SessionJoinResponse.from(participantRepository.save(participant));
    }

    @Transactional
    public ParticipantStatusResponse updateParticipantStatus(Long memberId, Long sessionId, Long userId, ParticipantStatusRequest request) {
        if (!memberId.equals(userId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        SessionParticipant participant = participantRepository.findByInterviewSessionAndMember(session, member)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_REQUEST));

        AnswerStatus answerStatus = parseAnswerStatus(request.answerStatus());
        participant.updateAnswerStatus(answerStatus);

        return ParticipantStatusResponse.from(participant);
    }

    private SessionStatus parseSessionStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
        try {
            return SessionStatus.valueOf(status.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
    }

    private AnswerStatus parseAnswerStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        return switch (status.toLowerCase(Locale.ROOT)) {
            case "idle", "waiting" -> AnswerStatus.WAITING;
            case "answering" -> AnswerStatus.ANSWERING;
            case "done", "answering_done" -> AnswerStatus.ANSWERING_DONE;
            default -> throw new CustomException(ErrorCode.INVALID_REQUEST);
        };
    }

    private void validateSessionAccess(Long memberId, InterviewSession session) {
        boolean isMentor = session.getMentor().getId().equals(memberId);
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session,
                        memberRepository.getReferenceById(memberId))
                .isPresent();

        if (!isMentor && !isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
