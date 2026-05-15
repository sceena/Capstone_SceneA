package com.backend.domain.reservation.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.reservation.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    Optional<Reservation> findByMentorAvailability(MentorAvailability mentorAvailability);

    List<Reservation> findAllByMentee(Member mentee);
}
