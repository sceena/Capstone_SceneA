package com.backend.domain.mentorAvailability.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentorAvailabilityRepository extends JpaRepository<MentorAvailability, Long> {

    List<MentorAvailability> findAllByMentorAndIsBookedFalse(Member mentor);
}
