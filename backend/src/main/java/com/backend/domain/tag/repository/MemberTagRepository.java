package com.backend.domain.tag.repository;

import com.backend.domain.member.entity.Member;
import com.backend.domain.tag.entity.MemberTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberTagRepository extends JpaRepository<MemberTag, Long> {

    List<MemberTag> findAllByMember(Member member);

    void deleteAllByMember(Member member);
}
