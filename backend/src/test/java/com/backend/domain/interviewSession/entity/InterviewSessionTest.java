package com.backend.domain.interviewSession.entity;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InterviewSessionTest {

    private InterviewSession session;

    @BeforeEach
    void setUp() {
        Member mentor = Member.builder()
                .email("mentor@test.com")
                .password("password")
                .name("멘토")
                .nickname("멘토닉")
                .role(Role.MENTOR)
                .build();

        session = InterviewSession.builder()
                .mentor(mentor)
                .scheduledAt(LocalDateTime.now())
                .build();
    }

    @Test
    void 세션_상태_SCHEDULED에서_IN_PROGRESS로_전환() {
        session.progressStatus();

        assertThat(session.getStatus()).isEqualTo(SessionStatus.IN_PROGRESS);
    }

    @Test
    void 세션_상태_IN_PROGRESS에서_COMPLETED로_전환() {
        session.progressStatus();
        session.progressStatus();

        assertThat(session.getStatus()).isEqualTo(SessionStatus.COMPLETED);
    }

    @Test
    void 세션_상태_COMPLETED에서_전환_시_예외() {
        session.progressStatus();
        session.progressStatus();

        assertThatThrownBy(() -> session.progressStatus())
                .isInstanceOf(CustomException.class)
                .satisfies(e -> assertThat(((CustomException) e).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_SESSION_STATUS));
    }
}
