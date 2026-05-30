package com.backend.domain.interviewAnswer.service;

import com.backend.domain.ai.client.AiSttClient;
import com.backend.domain.ai.dto.response.AiSttResponse;
import com.backend.domain.interviewAnswer.dto.request.MentorScoreRequest;
import com.backend.domain.interviewAnswer.dto.response.AnswerDetailResponse;
import com.backend.domain.interviewAnswer.dto.response.AnswerUploadResponse;
import com.backend.domain.interviewAnswer.dto.response.MentorScoreResponse;
import com.backend.domain.interviewAnswer.dto.response.SessionSttStatusResponse;
import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class AnswerService {

    private final InterviewAnswerRepository answerRepository;
    private final InterviewQuestionRepository questionRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;
    private final S3Client s3Client;
    private final AiSttClient aiSttClient;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Transactional
    public AnswerUploadResponse uploadAnswer(Long memberId, Long sessionId, Long questionId,
                                              MultipartFile audio, LocalDateTime answerStart,
                                              LocalDateTime answerEnd, Long requestMenteeId) {
        if (!memberId.equals(requestMenteeId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        InterviewSession session = findSession(sessionId);
        validateSessionInProgress(session);
        InterviewQuestion question = findQuestion(questionId, session);
        Member member = findMember(memberId);
        validateParticipant(member, session);

        String key = uploadToS3(audio);

        Optional<InterviewAnswer> existing = answerRepository.findByInterviewQuestionAndMember(question, member);
        InterviewAnswer answer;
        if (existing.isPresent()) {
            deleteFromS3(existing.get().getAudioUrl());
            existing.get().updateAudio(key, answerStart, answerEnd);
            existing.get().updateSttText(null);
            existing.get().updateSttStatus(SttStatus.PENDING);
            answer = existing.get();
        } else {
            answer = answerRepository.save(InterviewAnswer.builder()
                    .interviewQuestion(question)
                    .member(member)
                    .audioUrl(key)
                    .answerStart(answerStart)
                    .answerEnd(answerEnd)
                    .build());
        }

        transcribeAnswer(answer, audio);

        return AnswerUploadResponse.from(answer, sessionId);
    }

    public List<AnswerDetailResponse> getAnswers(Long memberId, Long sessionId, Long questionId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);
        InterviewQuestion question = findQuestion(questionId, session);

        return answerRepository.findAllByInterviewQuestion(question).stream()
                .map(a -> AnswerDetailResponse.from(a, sessionId))
                .toList();
    }

    public SessionSttStatusResponse getSessionSttStatus(Long memberId, Long sessionId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        List<InterviewQuestion> questions = questionRepository.findAllByInterviewSessionOrderByOrderIndex(session);
        List<InterviewAnswer> answers = questions.isEmpty()
                ? List.of()
                : answerRepository.findAllByInterviewQuestionIn(questions);

        int completed = countByStatus(answers, SttStatus.COMPLETED);
        int pending = countByStatus(answers, SttStatus.PENDING);
        int processing = countByStatus(answers, SttStatus.PROCESSING);
        int failed = countByStatus(answers, SttStatus.FAILED);
        Set<InterviewQuestion> answeredQuestions = answers.stream()
                .map(InterviewAnswer::getInterviewQuestion)
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);
        int questionPending = countQuestionByStatus(answeredQuestions, SttStatus.PENDING);
        int questionProcessing = countQuestionByStatus(answeredQuestions, SttStatus.PROCESSING);
        int questionFailed = countQuestionByStatus(answeredQuestions, SttStatus.FAILED);
        boolean ready = !answers.isEmpty()
                && pending == 0
                && processing == 0
                && questionPending == 0
                && questionProcessing == 0;

        return new SessionSttStatusResponse(
                sessionId,
                answers.size(),
                completed,
                pending,
                processing,
                failed,
                questionPending,
                questionProcessing,
                questionFailed,
                ready,
                answers.stream()
                        .map(SessionSttStatusResponse.AnswerSttStatus::from)
                        .toList(),
                answeredQuestions.stream()
                        .map(SessionSttStatusResponse.QuestionSttStatus::from)
                        .toList()
        );
    }

    public Resource getAudio(Long memberId, Long sessionId, Long questionId, Long answerId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);
        InterviewQuestion question = findQuestion(questionId, session);
        InterviewAnswer answer = findAnswer(answerId, question);

        try {
            return new InputStreamResource(s3Client.getObject(
                    GetObjectRequest.builder()
                            .bucket(bucket)
                            .key(answer.getAudioUrl())
                            .build()));
        } catch (NoSuchKeyException e) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }
    }

    @Transactional
    public MentorScoreResponse updateMentorScore(Long mentorId, Long sessionId, Long questionId,
                                                  Long answerId, MentorScoreRequest request) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);
        InterviewQuestion question = findQuestion(questionId, session);
        InterviewAnswer answer = findAnswer(answerId, question);

        if (request.mentorScore() < 1.0f || request.mentorScore() > 5.0f) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        answer.updateMentorScore(request.mentorScore());
        return MentorScoreResponse.from(answer);
    }

    private String uploadToS3(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            String extension = (originalFilename != null && originalFilename.contains("."))
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".wav";
            String key = "answers/" + UUID.randomUUID() + extension;

            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize())
            );

            return key;
        } catch (IOException | S3Exception e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private void deleteFromS3(String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
        } catch (S3Exception ignored) {
        }
    }

    private void transcribeAnswer(InterviewAnswer answer, MultipartFile audio) {
        answer.updateSttStatus(SttStatus.PROCESSING);
        try {
            AiSttResponse response = aiSttClient.transcribe(audio);
            answer.completeStt(
                    response.text(),
                    response.model(),
                    response.durationSec(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
            log.info("STT completed synchronously for answerId={}", answer.getId());
        } catch (RuntimeException e) {
            answer.failStt("AI STT server request failed");
            log.warn("Failed to transcribe answerId={}; sttStatus set to FAILED", answer.getId(), e);
        }
    }

    private int countByStatus(List<InterviewAnswer> answers, SttStatus status) {
        return (int) answers.stream()
                .filter(answer -> answer.getSttStatus() == status)
                .count();
    }

    private int countQuestionByStatus(Set<InterviewQuestion> questions, SttStatus status) {
        return (int) questions.stream()
                .filter(question -> question.getSttStatus() == status)
                .count();
    }

    private InterviewSession findSession(Long sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
    }

    private InterviewQuestion findQuestion(Long questionId, InterviewSession session) {
        InterviewQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_FOUND));
        if (!question.getInterviewSession().getId().equals(session.getId())) {
            throw new CustomException(ErrorCode.QUESTION_NOT_FOUND);
        }
        return question;
    }

    private InterviewAnswer findAnswer(Long answerId, InterviewQuestion question) {
        InterviewAnswer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));
        if (!answer.getInterviewQuestion().getId().equals(question.getId())) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }
        return answer;
    }

    private Member findMember(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
    }

    private void validateSessionInProgress(InterviewSession session) {
        if (session.getStatus() != SessionStatus.IN_PROGRESS) {
            throw new CustomException(ErrorCode.INVALID_SESSION_STATUS);
        }
    }

    private void validateMentorAccess(Long mentorId, InterviewSession session) {
        if (!session.getMentor().getId().equals(mentorId)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void validateSessionAccess(Long memberId, InterviewSession session) {
        boolean isMentor = session.getMentor().getId().equals(memberId);
        boolean isParticipant = participantRepository
                .findByInterviewSessionAndMember(session, memberRepository.getReferenceById(memberId))
                .isPresent();
        if (!isMentor && !isParticipant) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void validateParticipant(Member member, InterviewSession session) {
        if (session.getMentor().getId().equals(member.getId())) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
        if (!participantRepository.existsByInterviewSessionAndMember(session, member)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
