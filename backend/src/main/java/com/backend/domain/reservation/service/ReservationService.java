package com.backend.domain.reservation.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.dto.response.ReservationAcceptResponse;
import com.backend.domain.reservation.dto.response.ReservationResponse;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.repository.ReservationRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final MentorAvailabilityRepository mentorAvailabilityRepository;
    private final MemberRepository memberRepository;
    private final InterviewSessionRepository interviewSessionRepository;

    @Transactional
    public ReservationResponse createReservation(Long menteeId, ReservationRequest request) {
        Member mentee = memberRepository.findById(menteeId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        MentorAvailability availability = mentorAvailabilityRepository.findById(request.availabilityId())
                .orElseThrow(() -> new CustomException(ErrorCode.AVAILABILITY_NOT_FOUND));

        if (availability.isBooked()) {
            throw new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN);
        }

        availability.book();

        Reservation reservation = Reservation.builder()
                .mentorAvailability(availability)
                .mentee(mentee)
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
            InterviewSession session = InterviewSession.builder()
                    .mentor(mentor)
                    .scheduledAt(reservation.getMentorAvailability().getStartTime())
                    .build();
            interviewSessionRepository.save(session);
        } else {
            reservation.cancel();
        }

        return ReservationAcceptResponse.from(reservation);
    }
}
