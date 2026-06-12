package com.backend.domain.interviewAnswer.service;

import com.backend.domain.ai.client.AiSttClient;
import com.backend.domain.ai.client.SttTranscriptNormalizer;
import com.backend.domain.ai.dto.response.AiSttResponse;
import com.backend.domain.interviewAnswer.dto.request.MentorScoreRequest;
import com.backend.domain.interviewAnswer.dto.response.AnswerAudioResponse;
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
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
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
    private final SttTranscriptNormalizer sttTranscriptNormalizer;

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
        validateQuestionAnswerTarget(question, member);

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
        int failed = countByStatus(answers, SttStatus.FAILED) + countBlankCompletedAnswers(answers);
        Set<InterviewQuestion> audioQuestions = questions.stream()
                .filter(this::hasQuestionAudio)
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);
        int questionPending = countQuestionByStatus(audioQuestions, SttStatus.PENDING);
        int questionProcessing = countQuestionByStatus(audioQuestions, SttStatus.PROCESSING);
        int questionFailed = countQuestionByStatus(audioQuestions, SttStatus.FAILED) + countBlankCompletedQuestions(audioQuestions);
        boolean ready = !answers.isEmpty()
                && pending == 0
                && processing == 0
                && failed == 0
                && questionPending == 0
                && questionProcessing == 0
                && questionFailed == 0;

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
                audioQuestions.stream()
                        .map(SessionSttStatusResponse.QuestionSttStatus::from)
                        .toList()
        );
    }

    public AnswerAudioResponse getAudio(Long memberId, Long sessionId, Long questionId, Long answerId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);
        InterviewQuestion question = findQuestion(questionId, session);
        InterviewAnswer answer = findAnswer(answerId, question);

        return streamAnswerAudio(answer);
    }

    public AnswerAudioResponse getAudioByAnswerId(Long memberId, Long sessionId, Long answerId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);
        InterviewAnswer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));
        validateAnswerInSession(answer, session);

        return streamAnswerAudio(answer);
    }

    private AnswerAudioResponse streamAnswerAudio(InterviewAnswer answer) {
        try {
            ResponseInputStream<GetObjectResponse> object = s3Client.getObject(
                    GetObjectRequest.builder()
                            .bucket(bucket)
                            .key(answer.getAudioUrl())
                            .build());
            return new AnswerAudioResponse(
                    new InputStreamResource(object),
                    resolveAudioMediaType(answer.getAudioUrl(), object.response().contentType()),
                    resolveFilename(answer.getAudioUrl())
            );
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

    private MediaType resolveAudioMediaType(String key, String s3ContentType) {
        if (s3ContentType != null && !s3ContentType.isBlank()) {
            return MediaType.parseMediaType(s3ContentType);
        }
        String lowerKey = key == null ? "" : key.toLowerCase();
        if (lowerKey.endsWith(".webm")) {
            return MediaType.parseMediaType("audio/webm");
        }
        if (lowerKey.endsWith(".wav")) {
            return MediaType.parseMediaType("audio/wav");
        }
        if (lowerKey.endsWith(".mp3")) {
            return MediaType.parseMediaType("audio/mpeg");
        }
        if (lowerKey.endsWith(".mp4") || lowerKey.endsWith(".m4a")) {
            return MediaType.parseMediaType("audio/mp4");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    private String resolveFilename(String key) {
        if (key == null || key.isBlank()) {
            return "answer-audio.webm";
        }
        int slashIndex = key.lastIndexOf('/');
        return slashIndex >= 0 ? key.substring(slashIndex + 1) : key;
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
            String normalizedText = sttTranscriptNormalizer.normalize(response.text());
            if (normalizedText == null || normalizedText.isBlank()) {
                throw new IllegalStateException("AI STT returned empty transcript");
            }
            answer.completeStt(
                    normalizedText,
                    response.model(),
                    response.durationSec(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
            log.info(
                    "STT completed synchronously for answerId={} textLength={} quality={} message={}",
                    answer.getId(),
                    normalizedText.length(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
        } catch (RuntimeException e) {
            answer.failStt(e.getMessage() != null ? e.getMessage() : "AI STT server request failed");
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

    private int countBlankCompletedAnswers(List<InterviewAnswer> answers) {
        return (int) answers.stream()
                .filter(answer -> answer.getSttStatus() == SttStatus.COMPLETED)
                .filter(answer -> answer.getSttText() == null || answer.getSttText().isBlank())
                .count();
    }

    private int countBlankCompletedQuestions(Set<InterviewQuestion> questions) {
        return (int) questions.stream()
                .filter(question -> question.getSttStatus() == SttStatus.COMPLETED)
                .filter(question -> question.getContent() == null
                        || question.getContent().isBlank()
                        || "질문 음성 변환 중입니다.".equals(question.getContent()))
                .count();
    }

    private boolean hasQuestionAudio(InterviewQuestion question) {
        return question.getAudioUrl() != null && !question.getAudioUrl().isBlank();
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

    private void validateAnswerInSession(InterviewAnswer answer, InterviewSession session) {
        if (!answer.getInterviewQuestion().getInterviewSession().getId().equals(session.getId())) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }
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

    private void validateQuestionAnswerTarget(InterviewQuestion question, Member member) {
        Long candidateId = question.getCandidateId();
        if (candidateId != null && !candidateId.equals(member.getId())) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
    }
}
