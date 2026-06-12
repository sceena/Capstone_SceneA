package com.backend.domain.member.dto.request;

import com.backend.domain.tag.dto.TagRequest;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record UserProfileUpdateRequest(
        @Schema(description = "변경할 이름. null이면 변경 없음", example = "홍길동") String name,
        @Schema(description = "변경할 비밀번호. null이면 변경 없음", example = "newpassword123!") String password,
        @Schema(description = "한줄소개. null이면 변경 없음", example = "백엔드 개발 3년차입니다.") String bio,
        @Schema(description = "태그 목록. null이면 변경 없음, 빈 배열이면 전체 삭제",
                example = "[{\"name\": \"자바\", \"category\": \"기술스택\"}, {\"name\": \"3년\", \"category\": \"근속년수\"}]")
        List<TagRequest> tags
) {
}
