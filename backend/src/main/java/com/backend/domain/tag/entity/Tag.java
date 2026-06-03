package com.backend.domain.tag.entity;

import com.backend.global.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tag", uniqueConstraints = @UniqueConstraint(columnNames = {"name", "category"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Tag extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column
    private String category;

    @Builder
    public Tag(String name, String category) {
        this.name = name;
        this.category = category;
    }
}
