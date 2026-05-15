package com.backend.domain.interviewAnswer.entity;

import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class InterviewAnswerTest {

    private InterviewAnswer answer;

    @BeforeEach
    void setUp() {
        Member mentor = Member.builder()
                .email("mentor@test.com")
                .password("password")
                .name("멘토")
                .nickname("멘토닉")
                .role(Role.MENTOR)
                .build();

        InterviewSession session = InterviewSession.builder()
                .mentor(mentor)
                .scheduledAt(LocalDateTime.now())
                .build();

        InterviewQuestion question = InterviewQuestion.builder()
                .interviewSession(session)
                .content("자기소개를 해주세요.")
                .orderIndex(1)
                .build();

        Member mentee = Member.builder()
                .email("mentee@test.com")
                .password("password")
                .name("멘티")
                .nickname("멘티닉")
                .role(Role.MENTEE)
                .build();

        answer = InterviewAnswer.builder()
                .interviewQuestion(question)
                .member(mentee)
                .audioUrl("https://example.com/audio.mp3")
                .build();
    }

    @Test
    void AI점수_있을_때_멘토점수_입력_시_gap_계산() {
        answer.updateAiScore(4.0f);
        answer.updateMentorScore(2.0f);

        assertThat(answer.getGap()).isEqualTo(2.0f);
    }

    @Test
    void AI점수_없을_때_멘토점수_입력_시_gap_null() {
        answer.updateMentorScore(3.0f);

        assertThat(answer.getMentorScore()).isEqualTo(3.0f);
        assertThat(answer.getGap()).isNull();
    }

    @Test
    void AI점수_나중에_입력해도_기존_gap은_유지() {
        answer.updateMentorScore(3.0f);
        answer.updateAiScore(5.0f);

        assertThat(answer.getGap()).isNull();
    }
}
