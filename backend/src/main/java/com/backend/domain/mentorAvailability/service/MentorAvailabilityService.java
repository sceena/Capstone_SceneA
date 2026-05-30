package com.backend.domain.mentorAvailability.service;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.dto.request.AvailabilityCreateRequest;
import com.backend.domain.mentorAvailability.dto.response.AvailabilityResponse;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MentorAvailabilityService {

    private final MentorAvailabilityRepository availabilityRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public List<AvailabilityResponse> getAvailabilities(Long mentorId) {
        Member mentor = memberRepository.findById(mentorId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (mentor.getRole() != Role.MENTOR) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        LocalDate tomorrow = LocalDate.now().plusDays(1);

        return availabilityRepository.findAllByMentorAndIsBookedFalse(mentor).stream()
                .peek(availability -> rollForwardIfExpired(availability, tomorrow))
                .map(AvailabilityResponse::from)
                .toList();
    }

    private void rollForwardIfExpired(MentorAvailability availability, LocalDate minimumDate) {
        if (!availability.getStartTime().toLocalDate().isBefore(minimumDate)) {
            return;
        }

        var start = availability.getStartTime();
        var end = availability.getEndTime();
        while (start.toLocalDate().isBefore(minimumDate)) {
            start = start.plusDays(7);
            end = end.plusDays(7);
        }
        availability.reschedule(start, end);
    }

    @Transactional
    public void delete(Long mentorId, Long availabilityId) {
        MentorAvailability availability = availabilityRepository.findById(availabilityId)
                .orElseThrow(() -> new CustomException(ErrorCode.AVAILABILITY_NOT_FOUND));

        if (!availability.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        if (availability.isBooked()) {
            throw new CustomException(ErrorCode.RESERVATION_SLOT_TAKEN);
        }

        availabilityRepository.delete(availability);
    }

    @Transactional
    public AvailabilityResponse create(Long mentorId, AvailabilityCreateRequest request) {
        Member mentor = memberRepository.findById(mentorId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (mentor.getRole() != Role.MENTOR) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor)
                .startTime(request.startTime())
                .endTime(request.endTime())
                .build();

        return AvailabilityResponse.from(availabilityRepository.save(availability));
    }
}
