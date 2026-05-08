package com.backend.domain.interviewQuestion.service;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionService {

    private final InterviewQuestionRepository questionRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public List<QuestionCreateResponse> createQuestions(Long mentorId, Long sessionId, QuestionCreateRequest request) {
        InterviewSession session = findSession(sessionId);
        validateMentorAccess(mentorId, session);

        List<QuestionCreateRequest.QuestionItem> items = request.questions();
        List<InterviewQuestion> questions = IntStream.range(0, items.size())
                .mapToObj(i -> InterviewQuestion.builder()
                        .interviewSession(session)
                        .content(items.get(i).content())
                        .orderIndex(i)
                        .build())
                .toList();

        return questionRepository.saveAll(questions).stream()
                .map(QuestionCreateResponse::from)
                .toList();
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
}
