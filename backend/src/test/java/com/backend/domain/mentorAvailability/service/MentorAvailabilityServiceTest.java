package com.backend.domain.mentorAvailability.service;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.dto.request.AvailabilityCreateRequest;
import com.backend.domain.mentorAvailability.dto.response.AvailabilityResponse;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.repository.ReservationRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class MentorAvailabilityServiceTest {

    @InjectMocks
    private MentorAvailabilityService availabilityService;

    @Mock
    private MentorAvailabilityRepository availabilityRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private ReservationRepository reservationRepository;

    @Test
    void 가용시간_조회_성공() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        MentorAvailability slot1 = MentorAvailability.builder().mentor(mentor).startTime(start).endTime(end).build();
        MentorAvailability slot2 = MentorAvailability.builder().mentor(mentor).startTime(start.plusDays(1)).endTime(end.plusDays(1)).build();
        ReflectionTestUtils.setField(slot1, "id", 10L);
        ReflectionTestUtils.setField(slot2, "id", 11L);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(availabilityRepository.findAllByMentorAndIsBookedFalse(mentor)).willReturn(List.of(slot1, slot2));

        List<AvailabilityResponse> result = availabilityService.getAvailabilities(1L);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).id()).isEqualTo(10L);
        assertThat(result.get(0).isBooked()).isFalse();
        assertThat(result.get(1).id()).isEqualTo(11L);
    }

    @Test
    void 가용시간_조회_슬롯없으면_빈배열() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(availabilityRepository.findAllByMentorAndIsBookedFalse(mentor)).willReturn(List.of());

        List<AvailabilityResponse> result = availabilityService.getAvailabilities(1L);

        assertThat(result).isEmpty();
    }

    @Test
    void 가용시간_조회_멘티가_요청하면_403() {
        Member mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("김멘티").nickname("멘티").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));

        assertThatThrownBy(() -> availabilityService.getAvailabilities(2L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 가용시간_삭제_성공() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        MentorAvailability slot = MentorAvailability.builder()
                .mentor(mentor)
                .startTime(LocalDateTime.of(2026, 6, 1, 19, 0))
                .endTime(LocalDateTime.of(2026, 6, 1, 20, 0))
                .build();
        ReflectionTestUtils.setField(slot, "id", 10L);

        given(availabilityRepository.findById(10L)).willReturn(Optional.of(slot));

        availabilityService.delete(1L, 10L);

        org.mockito.Mockito.verify(availabilityRepository).delete(slot);
    }

    @Test
    void 가용시간_삭제_본인슬롯아님_403() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        MentorAvailability slot = MentorAvailability.builder()
                .mentor(mentor)
                .startTime(LocalDateTime.of(2026, 6, 1, 19, 0))
                .endTime(LocalDateTime.of(2026, 6, 1, 20, 0))
                .build();
        ReflectionTestUtils.setField(slot, "id", 10L);

        given(availabilityRepository.findById(10L)).willReturn(Optional.of(slot));

        assertThatThrownBy(() -> availabilityService.delete(99L, 10L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 가용시간_삭제_이미예약된슬롯_409() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        MentorAvailability slot = MentorAvailability.builder()
                .mentor(mentor)
                .startTime(LocalDateTime.of(2026, 6, 1, 19, 0))
                .endTime(LocalDateTime.of(2026, 6, 1, 20, 0))
                .build();
        ReflectionTestUtils.setField(slot, "id", 10L);
        slot.book();

        given(availabilityRepository.findById(10L)).willReturn(Optional.of(slot));

        assertThatThrownBy(() -> availabilityService.delete(1L, 10L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.RESERVATION_SLOT_TAKEN));
    }

    @Test
    void 가용시간_삭제_슬롯없음_404() {
        given(availabilityRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> availabilityService.delete(1L, 999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.AVAILABILITY_NOT_FOUND));
    }

    @Test
    void 가용시간_등록_성공() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        AvailabilityCreateRequest request = new AvailabilityCreateRequest(start, end);

        MentorAvailability saved = MentorAvailability.builder()
                .mentor(mentor).startTime(start).endTime(end).build();
        ReflectionTestUtils.setField(saved, "id", 10L);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(availabilityRepository.save(any())).willReturn(saved);

        AvailabilityResponse result = availabilityService.create(1L, request);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.mentorId()).isEqualTo(1L);
        assertThat(result.startTime()).isEqualTo(start);
        assertThat(result.endTime()).isEqualTo(end);
        assertThat(result.isBooked()).isFalse();
    }

    @Test
    void 가용시간_등록_멘티가_요청하면_403() {
        Member mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("김멘티").nickname("멘티").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));

        assertThatThrownBy(() -> availabilityService.create(2L, new AvailabilityCreateRequest(
                LocalDateTime.of(2026, 6, 1, 19, 0),
                LocalDateTime.of(2026, 6, 1, 20, 0)
        )))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void 가용시간_조회_current_participants_반영() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("박지훈").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        LocalDateTime start = LocalDateTime.of(2026, 6, 1, 19, 0);
        LocalDateTime end = LocalDateTime.of(2026, 6, 1, 20, 0);
        MentorAvailability slot = MentorAvailability.builder()
                .mentor(mentor).startTime(start).endTime(end).maxParticipants(4).build();
        ReflectionTestUtils.setField(slot, "id", 10L);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(availabilityRepository.findAllByMentorAndIsBookedFalse(mentor)).willReturn(List.of(slot));
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(slot, ReservationStatus.CANCELLED)).willReturn(2L);

        List<AvailabilityResponse> result = availabilityService.getAvailabilities(1L);

        assertThat(result.get(0).currentParticipants()).isEqualTo(2);
        assertThat(result.get(0).maxParticipants()).isEqualTo(4);
    }

    @Test
    void 가용시간_등록_회원없음_404() {
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> availabilityService.create(999L, new AvailabilityCreateRequest(
                LocalDateTime.of(2026, 6, 1, 19, 0),
                LocalDateTime.of(2026, 6, 1, 20, 0)
        )))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }
}
