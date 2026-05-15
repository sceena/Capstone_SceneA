package com.backend.domain.interviewAnswer.repository;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InterviewAnswerRepository extends JpaRepository<InterviewAnswer, Long> {

    List<InterviewAnswer> findAllByInterviewQuestion(InterviewQuestion interviewQuestion);

    Optional<InterviewAnswer> findByInterviewQuestionAndMember(InterviewQuestion interviewQuestion, Member member);
}
