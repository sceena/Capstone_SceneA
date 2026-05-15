package com.backend.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 공통
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),

    // 인증
    DUPLICATE_EMAIL(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    WITHDRAWN_MEMBER(HttpStatus.UNAUTHORIZED, "탈퇴한 회원입니다."),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 회원입니다."),

    // 예약
    AVAILABILITY_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 가용 시간 슬롯입니다."),
    RESERVATION_SLOT_TAKEN(HttpStatus.CONFLICT, "이미 예약된 슬롯입니다."),
    RESERVATION_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 예약입니다."),

    // 세션
    SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 세션입니다."),
    INVALID_SESSION_STATUS(HttpStatus.BAD_REQUEST, "유효하지 않은 세션 상태 전환입니다."),

    // 질문
    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 질문입니다."),
    QUESTION_MODIFICATION_LOCKED(HttpStatus.FORBIDDEN, "면접 시작 후에는 질문을 수정하거나 삭제할 수 없습니다."),

    // 답변
    ANSWER_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 답변입니다."),

    // 채용공고 / 자소서
    JOB_POSTING_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 채용공고입니다."),
    RESUME_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 자소서입니다."),

    // AI 분석 / 리포트
    ANALYSIS_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 분석 결과입니다."),
    REPORT_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 리포트입니다."),
    AI_SERVER_ERROR(HttpStatus.BAD_GATEWAY, "AI 서버 호출에 실패했습니다.");

    private final HttpStatus httpStatus;
    private final String message;
}
