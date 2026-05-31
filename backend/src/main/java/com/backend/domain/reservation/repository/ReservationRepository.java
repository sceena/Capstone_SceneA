package com.backend.domain.reservation.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findAllByMentorAvailability(MentorAvailability mentorAvailability);

    long countByMentorAvailabilityAndStatusNot(MentorAvailability mentorAvailability, ReservationStatus status);

    boolean existsByMentorAvailability(MentorAvailability mentorAvailability);

    List<Reservation> findAllByMentee(Member mentee);

    List<Reservation> findAllByMentorAvailability_Mentor(Member mentor);

    List<Reservation> findAllByMentorAvailability_MentorAndStatus(Member mentor, ReservationStatus status);

    @Query("""
            select r
            from Reservation r
            join fetch r.mentorAvailability a
            join fetch r.mentee
            left join fetch r.interviewSession
            where a.mentor = :mentor
            order by a.startTime asc
            """)
    List<Reservation> findMentorReservations(@Param("mentor") Member mentor);

    @Query("""
            select r
            from Reservation r
            join fetch r.mentorAvailability a
            join fetch r.mentee
            left join fetch r.interviewSession
            where a.mentor = :mentor
              and r.status = :status
            order by a.startTime asc
            """)
    List<Reservation> findMentorReservationsByStatus(
            @Param("mentor") Member mentor,
            @Param("status") ReservationStatus status
    );
}
