package com.backend.domain.interviewQuestion.service;

import com.backend.domain.ai.client.AiSttClient;
import com.backend.domain.ai.client.SttTranscriptNormalizer;
import com.backend.domain.ai.dto.response.AiSttResponse;
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
import java.util.UUID;
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
    private final AiSttClient aiSttClient;
    private final SttTranscriptNormalizer sttTranscriptNormalizer;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Transactional
    public List<QuestionCreateResponse> createQuestions(Long mentorId, Long sessionId, QuestionCreateRequest request) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);

        List<QuestionCreateRequest.QuestionItem> items = request.questions();
        int nextOrderIndex = questionRepository.findAllByInterviewSessionOrderByOrderIndex(session).size();
        List<InterviewQuestion> questions = IntStream.range(0, items.size())
                .mapToObj(i -> InterviewQuestion.builder()
                        .interviewSession(session)
                        .content(items.get(i).content())
                        .orderIndex(nextOrderIndex + i)
                        .build())
                .toList();

        return questionRepository.saveAll(questions).stream()
                .map(QuestionCreateResponse::from)
                .toList();
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
        transcribeQuestion(saved, audio);
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

    private void transcribeQuestion(InterviewQuestion question, MultipartFile audio) {
        question.updateSttStatus(SttStatus.PROCESSING);
        try {
            AiSttResponse response = aiSttClient.transcribe(audio);
            String normalizedText = sttTranscriptNormalizer.normalize(response.text());
            if (normalizedText == null || normalizedText.isBlank()) {
                throw new IllegalStateException("AI STT returned empty transcript");
            }
            question.completeStt(
                    normalizedText,
                    response.model(),
                    response.durationSec(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
            log.info(
                    "Question STT completed synchronously for questionId={} textLength={} quality={} message={}",
                    question.getId(),
                    normalizedText.length(),
                    response.audioQualityStatus(),
                    response.audioQualityMessage()
            );
        } catch (RuntimeException e) {
            question.failStt(e.getMessage() != null ? e.getMessage() : "AI STT server request failed");
            log.warn("Failed to transcribe questionId={}; sttStatus set to FAILED", question.getId(), e);
        }
    }
}
