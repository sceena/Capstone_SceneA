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
import org.mockito.ArgumentCaptor;
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

    // ── getMenteeReservations ──────────────────────────────────────────────

    @Test
    void 멘티_전체_예약목록_조회() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getId()).thenReturn(3L);
        when(availability.getStartTime()).thenReturn(LocalDateTime.now().plusDays(1));
        when(availability.getMentor()).thenReturn(mentor);

        Reservation reservation = mock(Reservation.class);
        when(reservation.getId()).thenReturn(1L);
        when(reservation.getMentorAvailability()).thenReturn(availability);
        when(reservation.getInterviewSession()).thenReturn(null);
        when(reservation.getStatus()).thenReturn(ReservationStatus.PENDING);
        when(reservation.getCreateDate()).thenReturn(LocalDateTime.now());

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(reservationRepository.findMenteeReservations(mentee)).willReturn(List.of(reservation));

        var result = reservationService.getMenteeReservations(2L, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).mentorName()).isEqualTo("박멘토");
        assertThat(result.get(0).status()).isEqualTo(ReservationStatus.PENDING);
    }

    @Test
    void 멘티_status_필터로_예약목록_조회() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getId()).thenReturn(3L);
        when(availability.getStartTime()).thenReturn(LocalDateTime.now().plusDays(1));
        when(availability.getMentor()).thenReturn(mentor);

        Reservation confirmed = mock(Reservation.class);
        when(confirmed.getId()).thenReturn(2L);
        when(confirmed.getMentorAvailability()).thenReturn(availability);
        when(confirmed.getInterviewSession()).thenReturn(null);
        when(confirmed.getStatus()).thenReturn(ReservationStatus.CONFIRMED);
        when(confirmed.getCreateDate()).thenReturn(LocalDateTime.now());

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(reservationRepository.findMenteeReservationsByStatus(mentee, ReservationStatus.CONFIRMED))
                .willReturn(List.of(confirmed));

        var result = reservationService.getMenteeReservations(2L, ReservationStatus.CONFIRMED);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).status()).isEqualTo(ReservationStatus.CONFIRMED);
        verify(reservationRepository, never()).findMenteeReservations(any());
    }

    @Test
    void 멘티_존재하지_않으면_404() {
        given(memberRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> reservationService.getMenteeReservations(99L, null))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }

    // ── getMentorReservations ──────────────────────────────────────────────

    @Test
    void 멘토_전체_예약목록_조회() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getId()).thenReturn(3L);
        when(availability.getStartTime()).thenReturn(LocalDateTime.now().plusDays(1));

        Reservation reservation = mock(Reservation.class);
        when(reservation.getId()).thenReturn(1L);
        when(reservation.getMentorAvailability()).thenReturn(availability);
        when(reservation.getMentee()).thenReturn(mentee);
        when(reservation.getInterviewSession()).thenReturn(null);
        when(reservation.getStatus()).thenReturn(ReservationStatus.PENDING);
        when(reservation.getResumeContent()).thenReturn("자소서 내용");
        when(reservation.getRequestNote()).thenReturn("꼬리질문 피드백 부탁드려요");
        when(reservation.getCreateDate()).thenReturn(LocalDateTime.now());

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(reservationRepository.findMentorReservations(mentor)).willReturn(List.of(reservation));

        var result = reservationService.getMentorReservations(1L, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).resumeContent()).isEqualTo("자소서 내용");
        assertThat(result.get(0).requestNote()).isEqualTo("꼬리질문 피드백 부탁드려요");
        assertThat(result.get(0).menteeName()).isEqualTo("김멘티");
    }

    @Test
    void 멘토_status_필터로_예약목록_조회() {
        MentorAvailability availability = mock(MentorAvailability.class);
        when(availability.getId()).thenReturn(3L);
        when(availability.getStartTime()).thenReturn(LocalDateTime.now().plusDays(1));

        Reservation pending = mock(Reservation.class);
        when(pending.getId()).thenReturn(1L);
        when(pending.getMentorAvailability()).thenReturn(availability);
        when(pending.getMentee()).thenReturn(mentee);
        when(pending.getInterviewSession()).thenReturn(null);
        when(pending.getStatus()).thenReturn(ReservationStatus.PENDING);
        when(pending.getResumeContent()).thenReturn(null);
        when(pending.getRequestNote()).thenReturn(null);
        when(pending.getCreateDate()).thenReturn(LocalDateTime.now());

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(reservationRepository.findMentorReservationsByStatus(mentor, ReservationStatus.PENDING))
                .willReturn(List.of(pending));

        var result = reservationService.getMentorReservations(1L, ReservationStatus.PENDING);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).status()).isEqualTo(ReservationStatus.PENDING);
        verify(reservationRepository, never()).findMentorReservations(any());
    }

    // ── createReservation ──────────────────────────────────────────────────

    @Test
    void request_note_포함_예약_신청() {
        MentorAvailability availability = MentorAvailability.builder()
                .mentor(mentor).startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1)).maxParticipants(4).build();
        ReflectionTestUtils.setField(availability, "id", 10L);

        Reservation saved = savedReservationMock(availability);

        given(memberRepository.findById(2L)).willReturn(Optional.of(mentee));
        given(mentorAvailabilityRepository.findById(10L)).willReturn(Optional.of(availability));
        given(reservationRepository.findAllByMentorAvailability(availability)).willReturn(List.of());
        given(reservationRepository.save(any())).willReturn(saved);
        given(reservationRepository.countByMentorAvailabilityAndStatusNot(eq(availability), eq(ReservationStatus.CANCELLED))).willReturn(1L);

        reservationService.createReservation(2L, new ReservationRequest(1L, 10L, null, null, null, "꼬리질문 피드백 부탁드려요"));

        ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository).save(captor.capture());
        assertThat(captor.getValue().getRequestNote()).isEqualTo("꼬리질문 피드백 부탁드려요");
    }

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
