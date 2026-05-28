package com.backend.domain.member.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.MemberProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<Member> findByProviderAndProviderId(MemberProvider provider, String providerId);
}
