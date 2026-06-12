package com.backend.domain.member.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.member.entity.MemberProvider;
import com.backend.domain.member.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<Member> findByProviderAndProviderId(MemberProvider provider, String providerId);

    @Query("""
            SELECT m FROM Member m
            WHERE m.role = :role
            AND m.deletedAt IS NULL
            AND (:keyword IS NULL OR :keyword = ''
                OR m.name LIKE %:keyword%
                OR m.nickname LIKE %:keyword%
                OR m.bio LIKE %:keyword%
                OR EXISTS (
                    SELECT mt FROM MemberTag mt
                    WHERE mt.member = m AND mt.tag.name LIKE %:keyword%
                ))
            """)
    Page<Member> findMentors(@Param("role") Role role, @Param("keyword") String keyword, Pageable pageable);
}
