package com.backend.domain.speechAnalysis.service;

import com.backend.domain.interviewAnswer.entity.InterviewAnswer;
import com.backend.domain.interviewAnswer.repository.InterviewAnswerRepository;
import com.backend.domain.interviewQuestion.entity.InterviewQuestion;
import com.backend.domain.interviewQuestion.repository.InterviewQuestionRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.speechAnalysis.dto.response.ScriptSegmentResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse;
import com.backend.domain.speechAnalysis.dto.response.SessionAnalysisSummaryResponse.AnswerSummaryItem;
import com.backend.domain.speechAnalysis.dto.response.SpeechAnalysisResponse;
import com.backend.domain.speechAnalysis.entity.SpeechAnalysis;
import com.backend.domain.speechAnalysis.repository.ScriptSegmentRepository;
import com.backend.domain.speechAnalysis.repository.SpeechAnalysisRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SpeechAnalysisService {

    private final SpeechAnalysisRepository speechAnalysisRepository;
    private final ScriptSegmentRepository scriptSegmentRepository;
    private final InterviewAnswerRepository answerRepository;
    private final InterviewQuestionRepository questionRepository;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MemberRepository memberRepository;

    public SpeechAnalysisResponse getAnalysis(Long memberId, Long sessionId, Long questionId, Long answerId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        InterviewQuestion question = findQuestion(questionId, sessionId);
        InterviewAnswer answer = findAnswer(answerId, questionId);

        SpeechAnalysis analysis = speechAnalysisRepository.findByInterviewAnswer(answer)
                .orElseThrow(() -> new CustomException(ErrorCode.ANALYSIS_NOT_FOUND));

        return SpeechAnalysisResponse.from(answer, analysis);
    }

    public List<ScriptSegmentResponse> getSegments(Long memberId, Long sessionId, Long questionId, Long answerId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        findQuestion(questionId, sessionId);
        InterviewAnswer answer = findAnswer(answerId, questionId);

        SpeechAnalysis analysis = speechAnalysisRepository.findByInterviewAnswer(answer)
                .orElseThrow(() -> new CustomException(ErrorCode.ANALYSIS_NOT_FOUND));

        return scriptSegmentRepository.findAllBySpeechAnalysisOrderByOrderIndex(analysis).stream()
                .map(ScriptSegmentResponse::from)
                .toList();
    }

    public SessionAnalysisSummaryResponse getSummary(Long memberId, Long sessionId) {
        InterviewSession session = findSession(sessionId);
        validateSessionAccess(memberId, session);

        List<InterviewQuestion> questions = questionRepository
                .findAllByInterviewSessionOrderByOrderIndex(session);

        List<InterviewAnswer> allAnswers = questions.stream()
                .flatMap(q -> answerRepository.findAllByInterviewQuestion(q).stream())
                .toList();

        List<AnswerSummaryItem> items = allAnswers.stream()
                .map(a -> {
                    Optional<SpeechAnalysis> analysis = speechAnalysisRepository.findByInterviewAnswer(a);
                    if (analysis.isEmpty() || a.getAiScore() == null) return null;
                    return new AnswerSummaryItem(
                            a.getId(),
                            a.getAiScore(),
                            analysis.get().getWpm(),
                            analysis.get().getStarRatio()
                    );
                })
                .filter(item -> item != null)
                .toList();

        Long bestAnswerId = items.stream()
                .max(Comparator.comparing(AnswerSummaryItem::aiScore))
                .map(AnswerSummaryItem::answerId)
                .orElse(null);

        Long worstAnswerId = items.stream()
                .min(Comparator.comparing(AnswerSummaryItem::aiScore))
                .map(AnswerSummaryItem::answerId)
                .orElse(null);

        return new SessionAnalysisSummaryResponse(sessionId, items, bestAnswerId, worstAnswerId);
    }

    private InterviewSession findSession(Long sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
    }

    private InterviewQuestion findQuestion(Long questionId, Long sessionId) {
        InterviewQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_FOUND));
        if (!question.getInterviewSession().getId().equals(sessionId)) {
            throw new CustomException(ErrorCode.QUESTION_NOT_FOUND);
        }
        return question;
    }

    private InterviewAnswer findAnswer(Long answerId, Long questionId) {
        InterviewAnswer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));
        if (!answer.getInterviewQuestion().getId().equals(questionId)) {
            throw new CustomException(ErrorCode.ANSWER_NOT_FOUND);
        }
        return answer;
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
}
