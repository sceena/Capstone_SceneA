package com.backend.domain.reservation.service;

import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.mentorAvailability.entity.MentorAvailability;
import com.backend.domain.mentorAvailability.repository.MentorAvailabilityRepository;
import com.backend.domain.reservation.dto.request.ReservationAcceptRequest;
import com.backend.domain.reservation.dto.request.ReservationRequest;
import com.backend.domain.reservation.entity.Reservation;
import com.backend.domain.reservation.entity.ReservationStatus;
import com.backend.domain.reservation.repository.ReservationRepository;
import com.backend.domain.resume.repository.ResumeRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @InjectMocks
    private ReservationService reservationService;

    @Mock private ReservationRepository reservationRepository;
    @Mock private MentorAvailabilityRepository mentorAvailabilityRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private InterviewSessionRepository interviewSessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private ResumeRepository resumeRepository;

    private Member mentor;
    private Member mentee;

    @BeforeEach
    void setUp() {
        mentor = Member.builder()
                .email("mentor@test.com").password("pw").name("박멘토").nickname("멘토").role(Role.MENTOR).build();
        ReflectionTestUtils.setField(mentor, "id", 1L);

        mentee = Member.builder()
                .email("mentee@test.com").password("pw").name("김멘티").nickname("멘티").role(Role.MENTEE).build();
        ReflectionTestUtils.setField(mentee, "id", 2L);
    }

    private Reservation savedReservationMock(MentorAvailability availability) {
        Reservation saved = mock(Reservation.class);
        when(saved.getMentorAvailability()).thenReturn(availability);
        when(saved.getInterviewSession()).thenReturn(null);
        when(saved.getStatus()).thenReturn(ReservationStatus.PENDING);
        return saved;
    }

    // ── createReservation ──────────────────────────────────────────────────

    @Test
    void 이미_예약한_멘티가_재신청하면_409() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(4).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation existing = mock(Reservation.class);
        when(existing.getMentee()).thenReturn(mentee);
        when(existing.getStatus()).thenReturn(ReservationStatus.PENDING);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of(existing));

        assertThatThrownBy(() -> reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null)))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.RESERVATION_SLOT_TAKEN));
    }

    @Test
    void 취소된_예약이_있어도_재신청_가능() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(4).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation cancelled = mock(Reservation.class);
        when(cancelled.getMentee()).thenReturn(mentee);
        when(cancelled.getStatus()).thenReturn(ReservationStatus.CANCELLED);

        Reservation saved = savedReservationMock(availability);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of(cancelled));
        given(reservationRepository.save(any())).willReturn(saved);
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(0L);

        reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null));

        verify(reservationRepository).save(any());
    }

    @Test
    void 일대일_슬롯_신청_후_정원_도달_시_book() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(1).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation saved = savedReservationMock(availability);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of());
        given(reservationRepository.save(any())).willReturn(saved);
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(1L);

        reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null));

        assertThat(availability.isBooked()).isTrue();
    }

    @Test
    void 일대N_슬롯_정원_미달_시_isBooked_유지() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(4).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation saved = savedReservationMock(availability);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of());
        given(reservationRepository.save(any())).willReturn(saved);
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(2L);

        reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null));

        assertThat(availability.isBooked()).isFalse();
    }

    @Test
    void 일대N_슬롯_정원_도달_시_book() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(4).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation saved = savedReservationMock(availability);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of());
        given(reservationRepository.save(any())).willReturn(saved);
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(4L);

        reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null));

        assertThat(availability.isBooked()).isTrue();
    }

    // ── acceptReservation ──────────────────────────────────────────────────

    @Test
    void 거절_시_잔여_예약이_정원_미달이면_unbook() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getMentor()).thenReturn(mentor);
        when(availability.isBooked()).thenReturn(true);
        when(availability.getMaxParticipants()).thenReturn(4);

        Reservation reservation = mock(Reservation.class);
        when(reservation.getMentorAvailability()).thenReturn(availability);

        given(reservationRepository.findById(55L)).willReturn(Optional.of(reservation));
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(2L);

        reservationService.acceptReservation(1L, 55L, new ReservationAcceptRequest(false));

        verify(availability).unbook();
    }

    @Test
    void 거절_시_잔여_예약이_정원_이상이면_unbook_안함() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getMentor()).thenReturn(mentor);
        when(availability.isBooked()).thenReturn(true);
        when(availability.getMaxParticipants()).thenReturn(4);

        Reservation reservation = mock(Reservation.class);
        when(reservation.getMentorAvailability()).thenReturn(availability);

        given(reservationRepository.findById(55L)).willReturn(Optional.of(reservation));
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(4L);

        reservationService.acceptReservation(1L, 55L, new ReservationAcceptRequest(false));

        verify(availability, never()).unbook();
    }

    @Test
    void 일대N_두번째_수락_시_기존_세션_재사용() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getMentor()).thenReturn(mentor);

        InterviewSession existingSession = mock(InterviewSession.class);

        Reservation confirmedReservation = mock(Reservation.class);
        when(confirmedReservation.getInterviewSession()).thenReturn(existingSession);
        when(confirmedReservation.getStatus()).thenReturn(ReservationStatus.CONFIRMED);

        Reservation newReservation = mock(Reservation.class);
        when(newReservation.getMentorAvailability()).thenReturn(availability);
        when(newReservation.getMentee()).thenReturn(mentee);
        when(newReservation.getInterviewSession()).thenReturn(null);
        when(newReservation.getResumeContent()).thenReturn(null);

        given(reservationRepository.findById(56L)).willReturn(Optional.of(newReservation));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of(confirmedReservation, newReservation));
        given(participantRepository.existsByInterviewSessionAndMember(any(), any())).willReturn(false);

        reservationService.acceptReservation(1L, 56L, new ReservationAcceptRequest(true));

        verify(newReservation).linkSession(existingSession);
        verify(interviewSessionRepository, never()).save(any());
    }
}
