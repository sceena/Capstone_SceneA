package com.backend.domain.interviewAnswer.service;

import com.backend.domain.ai.client.SttTranscriptNormalizer;
import com.backend.domain.interviewAnswer.dto.request.SttCallbackRequest;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SttCallbackService {

    private final InterviewAnswerRepository answerRepository;
    private final InterviewQuestionRepository questionRepository;
    private final SttTranscriptNormalizer sttTranscriptNormalizer;

    public void handleCallback(SttCallbackRequest request) {
        if (request.questionId() != null) {
            handleQuestionCallback(request);
            return;
        }

        InterviewAnswer answer = answerRepository.findById(request.answerId())
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));

        if ("COMPLETED".equals(request.status())) {
            answer.completeStt(
                    sttTranscriptNormalizer.normalize(request.text()),
                    request.model(),
                    request.durationSec(),
                    request.audioQualityStatus(),
                    request.audioQualityMessage()
            );
            log.info("STT completed for answerId={}", request.answerId());
        } else if ("FAILED".equals(request.status())) {
            answer.failStt(request.errorMessage());
            log.warn("STT failed for answerId={}: {}", request.answerId(), request.errorMessage());
        } else {
            log.warn("Unknown STT callback status={} for answerId={}", request.status(), request.answerId());
        }
    }

    private void handleQuestionCallback(SttCallbackRequest request) {
        InterviewQuestion question = questionRepository.findById(request.questionId())
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_FOUND));

        if ("COMPLETED".equals(request.status())) {
            question.completeStt(
                    sttTranscriptNormalizer.normalize(request.text()),
                    request.model(),
                    request.durationSec(),
                    request.audioQualityStatus(),
                    request.audioQualityMessage()
            );
            log.info("Question STT completed for questionId={}", request.questionId());
        } else if ("FAILED".equals(request.status())) {
            question.failStt(request.errorMessage());
            log.warn("Question STT failed for questionId={}: {}", request.questionId(), request.errorMessage());
        } else {
            log.warn("Unknown STT callback status={} for questionId={}", request.status(), request.questionId());
        }
    }
}
