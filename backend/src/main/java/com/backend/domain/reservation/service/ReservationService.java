package com.backend.domain.reservation.service;

import com.backend.domain.interviewSession.entity.AnswerStatus;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.dto.response.MenteeReservationResponse;
import com.backend.domain.reservation.dto.response.ReservationAcceptResponse;
import com.backend.domain.reservation.dto.response.ReservationResponse;
import com.backend.domain.reservation.dto.response.ReservationSummaryResponse;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.repository.ReservationRepository;
import com.backend.domain.resume.entity.Resume;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final MentorAvailabilityRepository mentorAvailabilityRepository;
    private final MemberRepository memberRepository;
    private final InterviewSessionRepository interviewSessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final ResumeRepository resumeRepository;

    public List<ReservationSummaryResponse> getMentorReservations(Long mentorId, ReservationStatus status) {
        Member mentor = memberRepository.findById(mentorId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        List<Reservation> reservations = status != null
                ? reservationRepository.findMentorReservationsByStatus(mentor, status)
                : reservationRepository.findMentorReservations(mentor);

        return reservations.stream()
                .map(ReservationSummaryResponse::from)
                .toList();
    }

    public List<MenteeReservationResponse> getMenteeReservations(Long menteeId, ReservationStatus status) {
        Member mentee = memberRepository.findById(menteeId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        List<Reservation> reservations = status != null
                ? reservationRepository.findMenteeReservationsByStatus(mentee, status)
                : reservationRepository.findMenteeReservations(mentee);

        return reservations.stream()
                .map(MenteeReservationResponse::from)
                .toList();
    }

    @Transactional
    public ReservationResponse createReservation(Long menteeId, ReservationRequest request) {
        Member mentee = memberRepository.findById(menteeId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        MentorAvailability availability = mentorAvailabilityRepository.findById(request.availabilityId())
                .orElseThrow(() -> new CustomException(ErrorCode.AVAILABILITY_NOT_FOUND));

        if (availability.isBooked()) {
            throw new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN);
        }

        boolean alreadyReserved = reservationRepository.findAllByMentorAvailability(availability).stream()
                .anyMatch(r -> r.getMentee().getId().equals(menteeId) && r.getStatus() != ReservationStatus.CANCELLED);
        if (alreadyReserved) {
            throw new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN);
        }

        InterviewSession session = null;
        if (request.sessionId() != null) {
            session = interviewSessionRepository.findById(request.sessionId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
            if (!session.getMentor().getId().equals(availability.getMentor().getId())) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
            if (request.mentorId() != null && !session.getMentor().getId().equals(request.mentorId())) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
            boolean isParticipant = participantRepository
                    .findByInterviewSessionAndMember(session, mentee)
                    .isPresent();
            if (!isParticipant) {
                throw new CustomException(ErrorCode.ACCESS_DENIED);
            }
        }

        Reservation reservation = Reservation.builder()
                .mentorAvailability(availability)
                .mentee(mentee)
                .interviewSession(session)
                .resumeContent(request.resumeContent())
                .requestNote(request.requestNote())
                .build();

        Reservation saved = reservationRepository.save(reservation);

        long activeCount = reservationRepository.countByMentorAvailabilityAndStatusNot(availability, ReservationStatus.CANCELLED);
        if (activeCount >= availability.getMaxParticipants()) {
            availability.book();
        }

        return ReservationResponse.from(saved);
    }

    @Transactional
    public ReservationAcceptResponse acceptReservation(Long mentorId, Long reservationId, ReservationAcceptRequest request) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new CustomException(ErrorCode.RESERVATION_NOT_FOUND));

        Member mentor = reservation.getMentorAvailability().getMentor();
        if (!mentor.getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        if (request.accepted()) {
            reservation.confirm();
            InterviewSession session = reservation.getInterviewSession();
            if (session == null) {
                session = reservationRepository.findAllByMentorAvailability(reservation.getMentorAvailability()).stream()
                        .filter(r -> r.getInterviewSession() != null && r.getStatus() != ReservationStatus.CANCELLED)
                        .map(Reservation::getInterviewSession)
                        .findFirst()
                        .orElse(null);
                if (session == null) {
                    session = InterviewSession.builder()
                            .mentor(mentor)
                            .scheduledAt(reservation.getMentorAvailability().getStartTime())
                            .build();
                    interviewSessionRepository.save(session);
                }
                reservation.linkSession(session);
            } else {
                session.confirmSchedule(reservation.getMentorAvailability().getStartTime());
            }
            ensureMenteeParticipant(session, reservation.getMentee());
            saveResumeIfPresent(session, reservation.getMentee(), reservation.getResumeContent());
        } else {
            reservation.cancel();
            MentorAvailability availability = reservation.getMentorAvailability();
            if (availability.isBooked()) {
                long activeCount = reservationRepository.countByMentorAvailabilityAndStatusNot(availability, ReservationStatus.CANCELLED);
                if (activeCount < availability.getMaxParticipants()) {
                    availability.unbook();
                }
            }
        }

        return ReservationAcceptResponse.from(reservation);
    }

    private void ensureMenteeParticipant(InterviewSession session, Member mentee) {
        if (participantRepository.existsByInterviewSessionAndMember(session, mentee)) {
            return;
        }

        participantRepository.save(SessionParticipant.builder()
                .interviewSession(session)
                .member(mentee)
                .answerStatus(AnswerStatus.WAITING)
                .build());
    }

    private void saveResumeIfPresent(InterviewSession session, Member mentee, String resumeContent) {
        if (resumeContent == null || resumeContent.isBlank()) {
            return;
        }

        if (resumeRepository.findByInterviewSessionAndMember(session, mentee).isPresent()) {
            return;
        }

        resumeRepository.save(Resume.builder()
                .interviewSession(session)
                .member(mentee)
                .content(resumeContent)
                .build());
    }
}
