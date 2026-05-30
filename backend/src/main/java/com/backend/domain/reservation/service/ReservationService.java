package com.backend.domain.reservation.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.dto.response.ReservationAcceptResponse;
import com.backend.domain.reservation.dto.response.ReservationResponse;
import com.backend.domain.reservation.dto.response.ReservationSummaryResponse;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.repository.ReservationRepository;
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

    @Transactional
    public ReservationResponse createReservation(Long menteeId, ReservationRequest request) {
        Member mentee = memberRepository.findById(menteeId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        MentorAvailability availability = mentorAvailabilityRepository.findById(request.availabilityId())
                .orElseThrow(() -> new CustomException(ErrorCode.AVAILABILITY_NOT_FOUND));

        if (availability.isBooked()) {
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

        availability.book();

        Reservation reservation = Reservation.builder()
                .mentorAvailability(availability)
                .mentee(mentee)
                .interviewSession(session)
                .build();

        return ReservationResponse.from(reservationRepository.save(reservation));
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
                session = InterviewSession.builder()
                        .mentor(mentor)
                        .scheduledAt(reservation.getMentorAvailability().getStartTime())
                        .build();
                interviewSessionRepository.save(session);
            } else {
                session.confirmSchedule(reservation.getMentorAvailability().getStartTime());
            }
        } else {
            reservation.cancel();
        }

        return ReservationAcceptResponse.from(reservation);
    }
}
