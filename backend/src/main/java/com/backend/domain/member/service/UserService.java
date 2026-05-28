package com.backend.domain.member.service;

import com.backend.domain.analysisReport.entity.AnalysisReport;
import com.backend.domain.analysisReport.repository.AnalysisReportRepository;
import com.backend.domain.interviewSession.entity.InterviewSession;
import com.backend.domain.interviewSession.entity.SessionParticipant;
import com.backend.domain.interviewSession.repository.InterviewSessionRepository;
import com.backend.domain.interviewSession.repository.SessionParticipantRepository;
import com.backend.domain.member.dto.request.UserProfileUpdateRequest;
import com.backend.domain.member.dto.response.MySessionHistoryResponse;
import com.backend.domain.member.dto.response.UserProfileResponse;
import com.backend.domain.member.dto.response.UserProfileUpdateResponse;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.Role;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.tag.dto.TagRequest;
import com.backend.domain.tag.entity.MemberTag;
import com.backend.domain.tag.entity.Tag;
import com.backend.domain.tag.repository.MemberTagRepository;
import com.backend.domain.tag.repository.TagRepository;
import com.backend.global.config.S3Service;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final MemberRepository memberRepository;
    private final TagRepository tagRepository;
    private final MemberTagRepository memberTagRepository;
    private final S3Service s3Service;
    private final InterviewSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final AnalysisReportRepository reportRepository;
    private final PasswordEncoder passwordEncoder;

    public UserProfileResponse getMyProfile(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
        List<MemberTag> memberTags = memberTagRepository.findAllByMember(member);
        return UserProfileResponse.of(member, memberTags);
    }

    @Transactional
    public UserProfileUpdateResponse updateMyProfile(Long memberId, UserProfileUpdateRequest request, MultipartFile image) {
        boolean noData = request == null || (request.name() == null && request.password() == null && request.bio() == null && request.tags() == null);
        boolean noImage = image == null || image.isEmpty();
        if (noData && noImage) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (request != null) {
            String encodedPassword = request.password() != null ? passwordEncoder.encode(request.password()) : null;
            member.update(request.name(), encodedPassword, request.bio());

            if (request.tags() != null) {
                memberTagRepository.deleteAllByMember(member);
                request.tags().forEach(t -> {
                    Tag tag = tagRepository.findByNameAndCategory(t.name(), t.category())
                            .orElseGet(() -> tagRepository.save(Tag.builder().name(t.name()).category(t.category()).build()));
                    memberTagRepository.save(MemberTag.builder().member(member).tag(tag).build());
                });
            }
        }

        if (!noImage) {
            if (member.getProfileImageUrl() != null) {
                s3Service.deleteFile(member.getProfileImageUrl());
            }
            member.updateProfileImage(s3Service.uploadProfileImage(memberId, image));
        }

        return UserProfileUpdateResponse.from(member);
    }

    public MySessionHistoryResponse getMySessionHistory(Long memberId, Pageable pageable) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        Page<InterviewSession> sessionPage;
        if (member.getRole() == Role.MENTOR) {
            sessionPage = sessionRepository.findAllByMentor(member, pageable);
        } else {
            sessionPage = participantRepository.findAllByMember(member, pageable)
                    .map(SessionParticipant::getInterviewSession);
        }

        List<InterviewSession> sessions = sessionPage.getContent();
        Map<Long, AnalysisReport> reportMap = sessions.isEmpty() ? Map.of() :
                reportRepository.findAllByInterviewSessionIn(sessions).stream()
                        .collect(Collectors.toMap(r -> r.getInterviewSession().getId(), r -> r));

        return MySessionHistoryResponse.of(sessionPage, reportMap);
    }
}
