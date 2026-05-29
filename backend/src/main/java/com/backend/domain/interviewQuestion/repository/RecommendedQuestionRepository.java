package com.backend.domain.interviewQuestion.repository;

import com.backend.domain.interviewQuestion.entity.RecommendedQuestion;
import com.backend.domain.interviewQuestion.entity.RecommendedQuestionBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecommendedQuestionRepository extends JpaRepository<RecommendedQuestion, Long> {

    List<RecommendedQuestion> findAllByBatchOrderByTypeAscCandidateIdAscOrderIndexAsc(RecommendedQuestionBatch batch);

    void deleteAllByBatch(RecommendedQuestionBatch batch);
}
