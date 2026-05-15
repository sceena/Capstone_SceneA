# AI Report Integration Status

## 현재 목표

리포트는 상단, 중단, 하단으로 나누어 만든다. 현재는 하단의 질문별 상세
평가를 먼저 실제 SFT 모델과 연결했다. 상단 best/worst와 중단 Fit-Gap은
기본 구조는 있으나, 품질 고도화는 다음 작업으로 둔다.

전체 흐름은 다음과 같다.

```text
프론트
-> 백엔드 Spring
-> AI 서버 FastAPI
-> Qwen2.5-7B-Instruct + LoRA adapter
-> 평가 JSON 반환
-> 백엔드 저장 및 프론트 응답
```

## 현재 연결 상태

AI 서버는 `/report` 요청을 받으면 질문별 답변을 평가하고 전체 리포트 JSON을
반환한다. 질문별 평가는 SFT 모델을 사용할 수 있고 모델을 사용하지 않을 때만 fallback 평가가 동작한다.

SFT 모델 연결은 Colab T4에서 검증했다. `qwen2_5_7b_sft_debiased` adapter를
붙인 상태에서 `evaluation_source=sft`로 질문별 평가가 생성되는 것을 확인했다.

현재 모델 설정은 다음과 같다.

```text
base model: Qwen/Qwen2.5-7B-Instruct
adapter: qwen2_5_7b_sft_debiased
prompt: question + answer
output: reasoning, overall_score, strengths, improvements
```

SFT 모델은 STAR, Fit-Gap, 정량 음성 지표를 학습하지 않았다. 따라서 하단
질문별 평가는 SFT가 담당하고, STAR/정량 지표/핏갭은 별도 로직 또는 다음
composer 단계에서 처리한다.

## 하단: 질문별 상세 카드

하단은 현재 가장 먼저 연결된 핵심 기능이다.

사용 정보는 다음과 같다.

```text
question
answer
audio_url
answer_start
answer_end
```

AI 서버는 질문과 답변을 SFT 모델에 넣어 아래 정보를 만든다.

```text
score
reasoning
strengths
improvements
evaluation_source
replay
```

프론트는 하단 카드에서 다음 항목을 보여주면 된다.

```text
질문
답변
점수
판단 이유
장점
개선점
다시듣기
```

다시듣기는 AI가 만드는 값이 아니라 백엔드가 넘긴 오디오 URL과 답변 시작/종료
시간을 그대로 사용한다.

## 백엔드 API 명세

### AI 리포트 생성

```http
POST /api/sessions/{sessionId}/report/generate
Authorization: Bearer {accessToken}
```

세션의 질문, 답변, 이력서, 채용공고 정보를 AI 서버에 보내 리포트를 생성하고
DB에 저장한다. 성공하면 생성된 리포트 응답을 바로 반환한다.

### AI 리포트 조회

```http
GET /api/sessions/{sessionId}/report
Authorization: Bearer {accessToken}
```

저장된 리포트를 조회한다. 백엔드는 `raw_ai_response_json`에 저장된 AI 응답을
다시 파싱해 `ai_report`로 내려준다.

## 프론트가 사용할 응답 구조

프론트는 `ReportResponse`의 `ai_report`를 사용하면 된다.

```json
{
  "id": 1,
  "session_id": 1,
  "report_status": "first",
  "total_score": 7.0,
  "ai_summary": "AI 리포트 요약",
  "ai_report": {
    "session_id": 1,
    "overall_score": 7.0,
    "top_summary": {
      "best_question": {},
      "worst_question": {}
    },
    "fit_gap": {
      "matched_requirements": [],
      "missing_requirements": [],
      "recommendations": []
    },
    "question_reports": [
      {
        "question_id": 101,
        "question": "질문 내용",
        "answer": "답변 내용",
        "score": 7.0,
        "reasoning": "점수 판단 이유",
        "strengths": ["장점"],
        "improvements": ["개선점"],
        "evaluation_source": "sft",
        "replay": {
          "audio_url": "오디오 URL",
          "start_time": "00:00:10",
          "end_time": "00:01:20"
        }
      }
    ]
  },
  "raw_ai_response_json": "{...}"
}
```

프론트 하단 카드의 기준 데이터는 다음 경로다.

```text
report.ai_report.question_reports
```

프론트 작업자는 이 배열을 순회해서 질문별 상세 카드를 만들면 된다.
`evaluation_source`는 개발 확인용으로 사용한다. 실제 모델이면 `sft`, fallback이면
`fallback`이다.

## DB 저장 방식

현재 DB는 질문별 평가를 별도 테이블로 나누지 않는다. AI 서버 전체 응답을
`analysis_report.raw_ai_response_json`에 JSON 문자열로 저장한다.

현재 방식은 빠르게 연동하기 좋다.

```text
analysis_report.raw_ai_response_json
-> top_summary
-> fit_gap
-> question_reports
```

추후 질문별 통계, 검색, 재평가 이력, 관리자 조회가 필요하면 별도 테이블을
만드는 것이 좋다.

```text
analysis_question_report
-> question_id
-> score
-> reasoning
-> strengths
-> improvements
-> evaluation_source
```

## 상단: Best/Worst 요약

상단은 현재 기본 구현이 있다. 질문별 평가 결과와 정량 지표, STAR 구조를 조합해
best/worst 문항을 고른다.

현재 기준은 다음과 같다.

```text
답변 점수
+ 말하기 정량 지표
+ STAR 구조
```

현재 품질은 기본 수준이다. 상단 품질을 높일 담당자는 다음을 개선하면 된다.

```text
best/worst 선정 가중치 조정
말하기 속도/침묵/문장 간결성 기준 정교화
상단 요약 문장 자연스럽게 생성
best/worst reason을 사용자 친화적으로 다듬기
```

## 중단: 채용공고 Fit-Gap

중단은 현재 키워드 기반이다. 채용공고 요약에서 기술 키워드를 찾고, 이력서와
면접 답변에 같은 키워드가 있는지 비교한다.

현재 입력은 다음과 같다.

```text
채용공고 요약
이력서 요약
전체 면접 답변
```

현재 출력은 다음과 같다.

```text
충족한 요구사항
부족한 요구사항
추천 보완 방향
```

현재 방식은 안정적이지만 문맥 이해가 약하다. 중단 품질을 높일 담당자는 다음
방향으로 확장하면 된다.

```text
키워드 매칭을 요구사항 문장 추출로 개선
채용공고 요구사항과 답변 근거를 문맥 기반으로 매칭
LLM composer로 matched/missing/recommendations 생성
SFT 질문별 평가 결과를 Fit-Gap 근거로 활용
```

## AI 서버 실행 방식

로컬 Mac에서는 Qwen 7B 모델 실행을 권장하지 않는다. 로컬에서는 fallback으로
백엔드/프론트 연동을 확인하고, 실제 모델은 Colab T4 또는 GPU 서버에서 실행한다.

검증용 실행은 다음과 같다. 


```bash
cd ai-server
pip install -r requirements-model.txt

export AI_MODEL_ENABLED=true
export AI_MODEL_REQUIRED=true
export AI_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct
export AI_ADAPTER_PATH=/content/drive/MyDrive/AI/models/lora_adapters/qwen2_5_7b_sft_debiased
export AI_PROMPT_FORMAT=plain
export AI_LOAD_IN_4BIT=true
export AI_OFFLOAD_DIR=/content/model_offload
export AI_DEVICE_MAP=auto

python scripts/smoke_model_report.py
```
돌려보니까 이런식으로 나옴 

session_id=1
overall_score=7.0
question_reports=2
question_id=101 | score=7.0 | source=sft | reasoning=답변은 실무 면접에서 납득 가능한 수준입니다. 중요한 개념은 맞지만 최상위 답변에 필요한 구체적 검증 근거가 부족해 7점입니다. | strengths=2 | improvements=2
question_id=102 | score=7.0 | source=sft | reasoning=트랜잭션 전파 옵션을의 핵심 원리와 주의점을 대체로 잘 설명했습니다. 다만 지표와 장애 사례가 더 있으면 좋아 7점입니다. | strengths=1 | improvements=1


운영 또는 시연에서는 GPU 서버에 `ai-server`를 띄우고, 백엔드의
`ai.server.base-url`을 해당 AI 서버 주소로 설정한다. Colab은 검증 또는 임시
시연용으로만 사용하는 것이 좋다.



