package com.backend.domain.answerEvaluation.repository;

import com.backend.domain.answerEvaluation.entity.AnswerEvaluation;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewSession.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnswerEvaluationRepository extends JpaRepository<AnswerEvaluation, Long> {

    Optional<AnswerEvaluation> findByInterviewAnswer(InterviewAnswer interviewAnswer);

    @Query("""
            select evaluation
            from AnswerEvaluation evaluation
            join fetch evaluation.interviewAnswer answer
            join fetch answer.member
            join fetch answer.interviewQuestion question
            where question.interviewSession = :session
            order by question.orderIndex, answer.id
            """)
    List<AnswerEvaluation> findAllByInterviewSession(@Param("session") InterviewSession session);

    @Query("""
            select evaluation
            from AnswerEvaluation evaluation
            join fetch evaluation.interviewAnswer answer
            join fetch answer.member
            join fetch answer.interviewQuestion question
            join fetch question.interviewSession session
            where evaluation.mentorReasoning is not null
               or evaluation.mentorScore is not null
               or evaluation.mentorStrengthsJson is not null
               or evaluation.mentorImprovementsJson is not null
            order by evaluation.id
            """)
    List<AnswerEvaluation> findDpoExportCandidates();
}
