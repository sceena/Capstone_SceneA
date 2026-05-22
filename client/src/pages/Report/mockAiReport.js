const mockAiReport = {
  id: 1,
  session_id: 1,
  report_status: "first",
  total_score: 7.1,
  alignment_score: null,
  best_moment: "Redis 캐시의 활용 목적과 성능 개선 사례를 구체적으로 설명했습니다.",
  worst_moment: "트랜잭션 전파 옵션의 실제 적용 사례가 부족했습니다.",
  ai_summary: "상단/중단 AI 리포트 화면 개발용 mock 데이터입니다.",
  ai_report: {
    session_id: 1,
    overall_score: 7.1,
    top_summary: {
      best_question: {
        question_id: 101,
        question: "Redis 캐시를 사용하는 이유를 설명해주세요.",
        reason: "Redis 캐시의 활용 목적과 함께 상품 조회 API에서 응답 속도를 개선한 실무 적용 사례를 구체적으로 기술하였습니다.",
        metrics_summary: {
          speaking_speed: "적정",
          silence: "침묵 없음",
          sentence_clarity: "명확",
          star_structure: "Action/Result 충족",
        },
      },
      worst_question: {
        question_id: 102,
        question: "트랜잭션 전파 옵션을 설명해주세요.",
        reason: "전파 옵션의 정의와 동작 방식은 명확히 제시하였으나 실무에서 해당 옵션이 필요한 구체적인 로직 사례는 포함되지 않았습니다.",
        metrics_summary: {
          speaking_speed: "느림",
          silence: "침묵 1회",
          sentence_clarity: "짧음",
          star_structure: "Action/Result 부족",
        },
      },
    },
    fit_gap: {
      matched_requirements: [
        "요구사항: Spring Boot 기반 API 개발 / 근거(지원자 제출 문서): 지원자 제출 문서에서 Spring Boot를 활용한 쇼핑몰 API 프로젝트 개발 경험을 명시하고 있습니다.",
        "요구사항: Redis 캐시 / 근거(Q1): Q1 답변에서 상품 조회 API의 반복 조회를 해결하기 위해 Redis에 TTL을 설정하여 적용하고, 응답 시간을 30% 개선한 구체적 사례를 설명합니다.",
        "요구사항: MySQL 성능 개선 / 근거(지원자 제출 문서): 지원자 제출 문서에 MySQL 인덱스 튜닝을 통해 성능을 개선한 경험이 있음을 기재하였습니다.",
      ],
      missing_requirements: [
        "요구사항: 장애 대응 경험 / 부족 근거: 제출 문서와 면접 답변 전반에서 시스템 장애 상황을 인지하고 해결하거나, 사후 분석을 진행한 구체적인 사례가 확인되지 않습니다.",
      ],
      recommendations: [
        "트랜잭션 전파 옵션에 대한 이론적 지식을 바탕으로, 실제 프로젝트에서 데이터 정합성 문제가 발생할 수 있는 시나리오를 설계하고 해결해 본 경험을 추가하는 것이 좋습니다.",
        "MySQL 인덱스 튜닝 시 실행 계획(Explain)을 확인하여 전후 성능 지표를 비교 분석한 과정을 포트폴리오에 상세히 기술하기를 권장합니다.",
        "부하 테스트 도구(nGrinder, JMeter 등)를 활용하여 시스템의 한계를 파악하고, 병목 지점을 찾아 개선한 경험을 통해 장애 대응 역량을 보완할 수 있습니다.",
      ],
    },
    question_reports: [
      {
        question_id: 101,
        question: "Redis 캐시를 사용하는 이유를 설명해주세요.",
        answer: "Redis 캐시는 자주 조회되는 데이터를 메모리에 저장해서 DB 부하를 줄일 때 사용한다고 생각합니다. 쇼핑몰 프로젝트에서 상품 상세 조회 요청이 반복적으로 들어오는 문제가 있어서, 변경이 적은 상품 정보에 TTL을 두고 캐싱했습니다. 그 결과 캐시 미스일 때만 DB를 조회하게 되었고, 평균 응답 시간도 약 30% 정도 줄었습니다.",
        score: 8.5,
        reasoning: "기술 선택 이유, 적용 상황, 본인이 수행한 조치, 개선 수치가 모두 포함되어 답변의 설득력이 높습니다.",
        strengths: [
          "답변에 충분한 설명량이 포함되어 있습니다.",
          "결과나 개선 효과를 언급해 설득력을 높였습니다.",
          "본인이 수행한 행동이 드러납니다.",
        ],
        improvements: ["현재 답변의 구체성을 유지하면서 핵심을 더 압축하세요."],
        evaluation_source: "fallback",
        replay: {
          audio_url: "answers/session-1/q101.wav",
          start_time: "2026-05-15T10:00:12",
          end_time: "2026-05-15T10:01:05",
        },
      },
      {
        question_id: 102,
        question: "트랜잭션 전파 옵션을 설명해주세요.",
        answer: "트랜잭션 전파 옵션은 메서드가 호출될 때 기존 트랜잭션에 참여할지, 새 트랜잭션을 만들지 정하는 설정으로 알고 있습니다. REQUIRED는 기존 트랜잭션이 있으면 참여하고, REQUIRES_NEW는 기존 트랜잭션과 분리해서 새로 시작합니다. 실제로는 기본적으로 REQUIRED를 많이 쓰고, 독립적으로 처리해야 하는 로직에는 REQUIRES_NEW를 사용할 수 있다고 이해하고 있습니다.",
        score: 4.7,
        reasoning: "개념 설명은 가능하지만 실제 비즈니스 로직에 적용한 사례가 부족해 경험 기반 답변으로는 약합니다.",
        strengths: [
          "REQUIRED와 REQUIRES_NEW의 기본 차이를 설명했습니다.",
          "트랜잭션 전파 옵션의 목적을 큰 방향에서는 이해하고 있습니다.",
        ],
        improvements: [
          "결제, 주문, 알림 발송처럼 트랜잭션 분리가 필요한 구체적인 사례를 연결하세요.",
          "각 옵션을 잘못 사용했을 때 발생할 수 있는 롤백 범위 문제를 함께 설명하세요.",
          "본인이 실제로 적용하거나 디버깅한 경험을 포함하면 답변 신뢰도가 올라갑니다.",
        ],
        evaluation_source: "fallback",
        replay: {
          audio_url: "answers/session-1/q102.wav",
          start_time: "2026-05-15T10:01:10",
          end_time: "2026-05-15T10:01:58",
        },
      },
      {
        question_id: 103,
        question: "MySQL 인덱스 튜닝 경험이 있다면 설명해주세요.",
        answer: "주문 목록 조회 API가 데이터가 늘어난 뒤부터 느려진 적이 있었습니다. 실행 계획을 확인해 보니 주문 상태와 생성일 조건에서 풀 스캔이 발생하고 있어서, 해당 조건을 기준으로 복합 인덱스를 추가했습니다. 이후 테스트 데이터 기준으로 조회 시간이 1초 이상에서 300ms대로 줄어드는 것을 확인했습니다.",
        score: 7.6,
        reasoning: "문제 상황과 실행 계획 확인, 복합 인덱스 적용, 개선 결과가 포함되어 실무 흐름이 비교적 잘 드러납니다.",
        strengths: [
          "성능 문제를 감으로 판단하지 않고 실행 계획을 확인한 점이 좋습니다.",
          "복합 인덱스와 정렬 조건을 함께 고려한 설명이 포함되어 있습니다.",
          "개선 전후 응답 시간을 수치로 제시했습니다.",
        ],
        improvements: [
          "인덱스 추가로 인한 쓰기 성능 비용이나 저장 공간 증가도 함께 언급하면 더 균형 잡힌 답변이 됩니다.",
          "운영 모니터링 경험이 부족했다는 부분은 향후 보완 계획과 함께 말하는 것이 좋습니다.",
        ],
        evaluation_source: "fallback",
        replay: {
          audio_url: "answers/session-1/q103.wav",
          start_time: "2026-05-15T10:02:05",
          end_time: "2026-05-15T10:02:58",
        },
      },
      {
        question_id: 104,
        question: "Spring Security를 적용할 때 중요하게 본 부분은 무엇인가요?",
        answer: "Spring Security를 사용할 때는 인증과 인가를 분리해서 설계하는 부분을 중요하게 봤습니다. 프로젝트에서는 로그인 후 JWT를 발급하고, 요청마다 토큰을 검증해서 SecurityContext에 사용자 정보를 넣는 방식으로 구현했습니다. 관리자 API와 일반 사용자 API의 권한은 나눴지만, Refresh Token이나 토큰 탈취 대응까지는 깊게 다루지 못했습니다.",
        score: 7.2,
        reasoning: "인증과 인가를 구분해 설명하고 JWT 기반 구현 경험을 제시했으나 보안 예외 상황 대응은 더 보완할 수 있습니다.",
        strengths: [
          "인증과 인가의 역할을 구분해서 설명했습니다.",
          "JWT 검증과 SecurityContext 저장 흐름을 언급했습니다.",
          "권한별 API 접근 제어 경험이 드러납니다.",
        ],
        improvements: [
          "Refresh Token 저장 방식과 만료 정책을 더 구체적으로 설명하세요.",
          "토큰 탈취나 권한 상승 공격 같은 보안 시나리오에 대한 대응을 보완하세요.",
        ],
        evaluation_source: "fallback",
        replay: {
          audio_url: "answers/session-1/q104.wav",
          start_time: "2026-05-15T10:03:08",
          end_time: "2026-05-15T10:04:02",
        },
      },
      {
        question_id: 105,
        question: "장애가 발생했을 때 어떤 순서로 대응하시겠습니까?",
        answer: "장애가 발생하면 먼저 사용자에게 어느 정도 영향이 있는지 확인할 것 같습니다. 예를 들어 응답 지연이라면 애플리케이션 로그, DB 커넥션 수, 외부 API 응답 시간을 보면서 원인을 좁혀갈 것 같습니다. 실제 운영 장애를 직접 대응한 경험은 많지 않아서, 개인 프로젝트에 모니터링을 붙여보면서 보완하고 있습니다.",
        score: 5.9,
        reasoning: "대응 순서는 설명했지만 실제 장애 처리 경험과 구체적인 도구 사용 사례가 부족합니다.",
        strengths: [
          "사용자 영향 범위 확인, 로그 확인, 임시 조치의 순서를 제시했습니다.",
          "응답 지연 상황에서 확인할 지표를 일부 언급했습니다.",
        ],
        improvements: [
          "Prometheus, Grafana, CloudWatch, ELK 등 실제 도구 기반 경험을 추가하세요.",
          "장애 발생 후 재발 방지 대책까지 포함하면 답변 완성도가 높아집니다.",
          "개인 프로젝트라도 의도적으로 장애 시나리오를 만들고 대응 기록을 남겨두면 좋습니다.",
        ],
        evaluation_source: "fallback",
        replay: {
          audio_url: "answers/session-1/q105.wav",
          start_time: "2026-05-15T10:04:10",
          end_time: "2026-05-15T10:04:55",
        },
      },
    ],
  },
  raw_ai_response_json: null,
  mentor_feedback: null,
  created_at: "2026-05-15T10:00:00",
  updated_at: "2026-05-15T10:00:00",
};

export default mockAiReport;
