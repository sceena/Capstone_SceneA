package com.backend.domain.member.service;

import com.backend.domain.member.dto.request.LoginRequest;
import com.backend.domain.member.dto.request.SignupRequest;
import com.backend.domain.member.dto.response.LoginResponse;
import com.backend.domain.member.entity.Member;
import com.backend.domain.member.repository.MemberRepository;
import com.backend.domain.tag.dto.TagRequest;
import com.backend.domain.tag.entity.MemberTag;
import com.backend.domain.tag.entity.Tag;
import com.backend.domain.tag.repository.MemberTagRepository;
import com.backend.domain.tag.repository.TagRepository;
import com.backend.global.exception.CustomException;
import com.backend.global.exception.ErrorCode;
import com.backend.global.jwt.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final MemberRepository memberRepository;
    private final TagRepository tagRepository;
    private final MemberTagRepository memberTagRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Transactional
    public void signup(SignupRequest request) {
        if (memberRepository.existsByEmail(request.email())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMAIL);
        }

        Member member = Member.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .nickname(request.nickname())
                .bio(request.bio())
                .role(request.role())
                .build();

        memberRepository.save(member);

        if (request.tags() != null) {
            saveTags(member, request.tags());
        }
    }

    private void saveTags(Member member, List<TagRequest> tags) {
        tags.forEach(t -> {
            Tag tag = tagRepository.findByNameAndCategory(t.name(), t.category())
                    .orElseGet(() -> tagRepository.save(Tag.builder().name(t.name()).category(t.category()).build()));
            memberTagRepository.save(MemberTag.builder().member(member).tag(tag).build());
        });
    }

    public LoginResponse login(LoginRequest request) {
        Member member = memberRepository.findByEmail(request.email())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS));

        if (member.isDeleted()) {
            throw new CustomException(ErrorCode.WITHDRAWN_MEMBER);
        }

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new CustomException(ErrorCode.INVALID_CREDENTIALS);
        }

        String accessToken = jwtProvider.generateAccessToken(member.getId(), member.getRole().name());
        String refreshToken = jwtProvider.generateRefreshToken(member.getId(), member.getRole().name());

        return new LoginResponse(accessToken, refreshToken);
    }

    @Transactional
    public void withdraw(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        member.softDelete();
    }
}
