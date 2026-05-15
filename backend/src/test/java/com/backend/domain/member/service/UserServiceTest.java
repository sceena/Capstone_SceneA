package com.backend.domain.member.service;

import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.dto.request.UserProfileUpdateRequest;
import com.backend.domain.member.dto.response.MySessionHistoryResponse;
import com.backend.domain.member.dto.response.UserProfileResponse;
import com.backend.domain.member.dto.response.UserProfileUpdateResponse;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.tag.entity.MemberTag;
import com.backend.domain.tag.entity.Tag;
import com.backend.domain.tag.repository.MemberTagRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @InjectMocks
    private UserService userService;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private MemberTagRepository memberTagRepository;

    @Mock
    private InterviewSessionRepository sessionRepository;

    @Mock
    private SessionParticipantRepository participantRepository;

    @Mock
    private AnalysisReportRepository reportRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void 내_프로필_조회_성공() {
        Member member = Member.builder()
                .email("hong@test.com").password("enc").name("홍길동").nickname("길동이").role(Role.MENTEE).build();
        Tag tag = Tag.builder().name("Spring").category("job_skill").build();
        MemberTag memberTag = MemberTag.builder().member(member).tag(tag).build();

        given(memberRepository.findById(1L)).willReturn(Optional.of(member));
        given(memberTagRepository.findAllByMember(member)).willReturn(List.of(memberTag));

        UserProfileResponse response = userService.getMyProfile(1L);

        assertThat(response.name()).isEqualTo("홍길동");
        assertThat(response.email()).isEqualTo("hong@test.com");
        assertThat(response.role()).isEqualTo("mentee");
        assertThat(response.tags()).hasSize(1);
        assertThat(response.tags().get(0).name()).isEqualTo("Spring");
        assertThat(response.tags().get(0).category()).isEqualTo("job_skill");
    }

    @Test
    void 내_프로필_조회_태그없음_빈배열() {
        Member member = Member.builder()
                .email("hong@test.com").password("enc").name("홍길동").nickname("길동이").role(Role.MENTEE).build();

        given(memberRepository.findById(1L)).willReturn(Optional.of(member));
        given(memberTagRepository.findAllByMember(member)).willReturn(List.of());

        UserProfileResponse response = userService.getMyProfile(1L);

        assertThat(response.tags()).isEmpty();
    }

    @Test
    void 내_프로필_조회_회원없음_예외() {
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getMyProfile(999L))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }

    @Test
    void 내_프로필_수정_이름만_변경_성공() {
        Member member = Member.builder()
                .email("hong@test.com").password("enc").name("홍길동").nickname("길동이").role(Role.MENTEE).build();
        UserProfileUpdateRequest request = new UserProfileUpdateRequest("새이름", null);

        given(memberRepository.findById(1L)).willReturn(Optional.of(member));

        UserProfileUpdateResponse response = userService.updateMyProfile(1L, request);

        assertThat(response.name()).isEqualTo("새이름");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void 내_프로필_수정_비밀번호만_변경_성공() {
        Member member = Member.builder()
                .email("hong@test.com").password("old_enc").name("홍길동").nickname("길동이").role(Role.MENTEE).build();
        UserProfileUpdateRequest request = new UserProfileUpdateRequest(null, "newpassword");

        given(memberRepository.findById(1L)).willReturn(Optional.of(member));
        given(passwordEncoder.encode("newpassword")).willReturn("new_enc");

        userService.updateMyProfile(1L, request);

        verify(passwordEncoder).encode("newpassword");
        assertThat(member.getPassword()).isEqualTo("new_enc");
    }

    @Test
    void 내_프로필_수정_수정할_필드_없음_예외() {
        UserProfileUpdateRequest request = new UserProfileUpdateRequest(null, null);

        assertThatThrownBy(() -> userService.updateMyProfile(1L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    void 내_프로필_수정_회원없음_예외() {
        UserProfileUpdateRequest request = new UserProfileUpdateRequest("새이름", null);
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateMyProfile(999L, request))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }

    @Test
    void 내_면접내역_조회_멘토_세션_레포지토리_호출() {
        Member mentor = Member.builder()
                .email("mentor@test.com").password("enc").name("멘토").nickname("멘토닉").role(Role.MENTOR).build();
        Page<com.backend.domain.interviewSession.entity.InterviewSession> emptyPage =
                new PageImpl<>(List.of(), PageRequest.of(0, 10), 0);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentor));
        given(sessionRepository.findAllByMentor(mentor, PageRequest.of(0, 10))).willReturn(emptyPage);

        MySessionHistoryResponse response = userService.getMySessionHistory(1L, PageRequest.of(0, 10));

        assertThat(response.content()).isEmpty();
        assertThat(response.totalElements()).isZero();
        verify(sessionRepository).findAllByMentor(eq(mentor), any());
        verify(participantRepository, never()).findAllByMember(any(), any());
    }

    @Test
    void 내_면접내역_조회_멘티_참여자_레포지토리_호출() {
        Member mentee = Member.builder()
                .email("mentee@test.com").password("enc").name("멘티").nickname("멘티닉").role(Role.MENTEE).build();
        Page<SessionParticipant> emptyPage = new PageImpl<>(List.of(), PageRequest.of(0, 10), 0);

        given(memberRepository.findById(1L)).willReturn(Optional.of(mentee));
        given(participantRepository.findAllByMember(mentee, PageRequest.of(0, 10))).willReturn(emptyPage);

        MySessionHistoryResponse response = userService.getMySessionHistory(1L, PageRequest.of(0, 10));

        assertThat(response.content()).isEmpty();
        assertThat(response.totalElements()).isZero();
        verify(participantRepository).findAllByMember(eq(mentee), any());
        verify(sessionRepository, never()).findAllByMentor(any(), any());
    }

    @Test
    void 내_면접내역_조회_회원없음_예외() {
        given(memberRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getMySessionHistory(999L, PageRequest.of(0, 10)))
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.MEMBER_NOT_FOUND));
    }
}
