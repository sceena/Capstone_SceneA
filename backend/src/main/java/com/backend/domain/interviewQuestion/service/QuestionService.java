package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiSttJobClient;
import com.backend.domain.ai.dto.request.AiSttJobRequest;
import com.backend.domain.interviewAnswer.entity.SttStatus;
import com.backend.domain.interviewQuestion.dto.request.QuestionCreateRequest;
import com.backend.domain.interviewQuestion.dto.request.QuestionUpdateRequest;
import com.backend.domain.interviewQuestion.dto.response.QuestionCreateResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionDetailResponse;
import com.backend.domain.interviewQuestion.dto.response.QuestionUpdateResponse;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionStatus;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class QuestionService {

    private final InterviewQuestionRepository questionRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;
    private final S3Client s3Client;
    private final AiSttJobClient aiSttJobClient;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${app.callback-base-url:http://localhost:8080}")
    private String callbackBaseUrl;

    @Transactional
    public List<QuestionCreateResponse> createQuestions(Long mentorId, Long sessionId, QuestionCreateRequest request) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);

        List<QuestionCreateRequest.QuestionItem> items = request.questions();
        validateQuestionTargets(session, items);

        int nextOrderIndex = questionRepository.findAllByInterviewSessionOrderByOrderIndex(session).size();
        List<InterviewQuestion> questions = IntStream.range(0, items.size())
                .mapToObj(i -> InterviewQuestion.builder()
                        .interviewSession(session)
                        .content(items.get(i).content())
                        .questionType(items.get(i).questionType())
                        .candidateId(items.get(i).candidateId())
                        .orderIndex(nextOrderIndex + i)
                        .build())
                .toList();

        return questionRepository.saveAll(questions).stream()
                .map(QuestionCreateResponse::from)
                .toList();
    }

    private void validateQuestionTargets(InterviewSession session, List<QuestionCreateRequest.QuestionItem> items) {
        if (items == null || items.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        Set<Long> menteeIds = participantRepository.findAllByInterviewSession(session).stream()
                .map(participant -> participant.getMember().getId())
                .filter(memberId -> !Objects.equals(memberId, session.getMentor().getId()))
                .collect(Collectors.toSet());

        boolean isGroup = menteeIds.size() > 1;
        for (QuestionCreateRequest.QuestionItem item : items) {
            if (item.content() == null || item.content().isBlank()) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }

            String questionType = item.questionType();
            if ("COMMON".equals(questionType) && item.candidateId() != null) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }

            if ("PERSONAL".equals(questionType)) {
                if (isGroup && item.candidateId() == null) {
                    throw new CustomException(ErrorCode.INVALID_REQUEST);
                }
                if (item.candidateId() != null && !menteeIds.contains(item.candidateId())) {
                    throw new CustomException(ErrorCode.INVALID_REQUEST);
                }
            }
        }
    }

    @Transactional
    public QuestionCreateResponse uploadQuestionAudio(Long mentorId, Long sessionId, MultipartFile audio) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);

        int orderIndex = questionRepository.findAllByInterviewSessionOrderByOrderIndex(session).size();
        InterviewQuestion question = InterviewQuestion.builder()
                .interviewSession(session)
                .content("질문 음성 변환 중입니다.")
                .orderIndex(orderIndex)
                .build();

        String key = uploadToS3(audio);
        question.updateAudio(key);
        InterviewQuestion saved = questionRepository.save(question);
        submitQuestionSttJob(saved);
        return QuestionCreateResponse.from(saved);
    }

    public List<QuestionDetailResponse> getQuestions(Long memberId, Long sessionId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        return questionRepository.findAllByInterviewSessionOrderByOrderIndex(session).stream()
                .map(QuestionDetailResponse::from)
                .toList();
    }

    public QuestionDetailResponse getQuestion(Long memberId, Long sessionId, Long questionId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        return QuestionDetailResponse.from(findQuestion(questionId, session));
    }

    @Transactional
    public QuestionUpdateResponse updateQuestion(Long mentorId, Long sessionId, Long questionId, QuestionUpdateRequest request) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);
        validateSessionScheduled(session);

        InterviewQuestion question = findQuestion(questionId, session);
        question.update(request.content());
        return QuestionUpdateResponse.from(question);
    }

    @Transactional
    public void deleteQuestion(Long mentorId, Long sessionId, Long questionId) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);
        validateSessionScheduled(session);

        questionRepository.delete(findQuestion(questionId, session));
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

    private void validateSessionScheduled(InterviewSession session) {
        if (session.getStatus() != SessionStatus.SCHEDULED) {
            throw new CustomException(ErrorCode.QUESTION_MODIFICATION_LOCKED);
        }
    }

    private String uploadToS3(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            String extension = (originalFilename != null && originalFilename.contains("."))
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".webm";
            String key = "questions/" + UUID.randomUUID() + extension;

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

    private void submitQuestionSttJob(InterviewQuestion question) {
        question.updateSttStatus(SttStatus.PROCESSING);
        try {
            aiSttJobClient.submitJob(AiSttJobRequest.forQuestion(
                    question.getId(),
                    question.getAudioUrl(),
                    callbackBaseUrl + "/api/internal/stt/callback"
            ));
            log.info("Question STT job submitted for questionId={}", question.getId());
        } catch (RuntimeException e) {
            question.failStt("AI STT server request failed");
            log.warn("Failed to transcribe questionId={}; sttStatus set to FAILED", question.getId(), e);
        }
    }
}
