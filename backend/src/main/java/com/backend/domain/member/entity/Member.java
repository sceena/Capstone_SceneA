package com.backend.domain.member.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member extends BaseEntity {

    @Column(nullable = true, unique = true)
    private String email;

    @Column
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberProvider provider;

    @Column
    private String providerId;

    @Column(length = 100)
    private String bio;

    @Column
    private String profileImageUrl;

    private LocalDateTime deletedAt;

    @Builder
    public Member(String email, String password, String name, String nickname, String bio, Role role,
                  MemberProvider provider, String providerId, String profileImageUrl) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.nickname = nickname;
        this.bio = bio;
        this.role = role;
        this.provider = provider != null ? provider : MemberProvider.LOCAL;
        this.providerId = providerId;
        this.profileImageUrl = profileImageUrl;
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return this.deletedAt != null;
    }

    public void update(String name, String encodedPassword, String bio) {
        if (name != null) this.name = name;
        if (encodedPassword != null) this.password = encodedPassword;
        if (bio != null) this.bio = bio;
    }

    public void updateProfileImage(String url) {
        this.profileImageUrl = url;
    }
}
