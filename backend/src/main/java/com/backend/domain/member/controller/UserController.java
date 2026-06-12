package com.backend.domain.member.controller;

import com.backend.domain.member.dto.request.UserProfileUpdateRequest;
import com.backend.domain.member.dto.response.MentorListResponse;
import com.backend.domain.member.dto.response.MySessionHistoryResponse;
import com.backend.domain.member.dto.response.UserProfileResponse;
import com.backend.domain.member.dto.response.UserProfileUpdateResponse;
import com.backend.domain.member.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Encoding;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "마이페이지", description = "내 프로필 조회 / 수정 / 면접 내역 조회")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-key")
public class UserController {

    private final UserService userService;

    @Operation(summary = "멘토 목록 조회", description = "keyword로 멘토를 검색한다. 미입력 시 전체 반환. page/size로 페이징.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @GetMapping("/mentors")
    public ResponseEntity<MentorListResponse.PageResponse> getMentors(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(userService.getMentors(keyword, PageRequest.of(page, size)));
    }

    @Operation(summary = "내 프로필 조회", description = "로그인한 사용자의 프로필 정보를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal Long memberId) {
        return ResponseEntity.ok(userService.getMyProfile(memberId));
    }

    @Operation(summary = "내 프로필 수정", description = "이름, 비밀번호, 태그, 프로필 사진을 수정한다. data 파트(JSON)와 image 파트(파일) 모두 선택적이나 둘 다 비면 400.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 성공"),
            @ApiResponse(responseCode = "400", description = "수정할 필드 없음 또는 이미지 파일 아님"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @RequestBody(content = @Content(mediaType = MediaType.MULTIPART_FORM_DATA_VALUE,
            encoding = @Encoding(name = "data", contentType = MediaType.APPLICATION_JSON_VALUE),
            schemaProperties = {
                    @SchemaProperty(name = "data", schema = @Schema(implementation = UserProfileUpdateRequest.class)),
                    @SchemaProperty(name = "image", schema = @Schema(type = "string", format = "binary", description = "프로필 이미지 파일"))
            }))
    @PatchMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileUpdateResponse> updateMyProfile(
            @AuthenticationPrincipal Long memberId,
            @RequestPart(value = "data", required = false) UserProfileUpdateRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(userService.updateMyProfile(memberId, request, image));
    }

    @Operation(summary = "내 면접 내역 조회", description = "마이페이지에서 본인이 참여한 면접 세션 목록과 리포트 상태를 조회한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음 또는 만료")
    })
    @GetMapping("/me/sessions")
    public ResponseEntity<MySessionHistoryResponse> getMySessionHistory(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(userService.getMySessionHistory(memberId, PageRequest.of(page, size)));
    }
}
