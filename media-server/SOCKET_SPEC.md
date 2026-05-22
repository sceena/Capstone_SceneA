# Media Server Socket.io 이벤트 명세서

## 서버 정보

| 항목 | 값 |
|---|---|
| 프로토콜 | Socket.io v4 (WebSocket) |
| 서버 주소 | `http://{서버IP}:4000` |

---

## 연결

```js
import { io } from 'socket.io-client';

const socket = io('http://{서버IP}:4000', {
  withCredentials: true,
});
```

---

## 공통 규칙

- 모든 이벤트는 **콜백(acknowledgement)** 방식으로 응답을 받습니다.
- 에러가 발생하면 콜백에 `{ error: "에러 메시지" }` 가 반환됩니다.
- 성공/실패 여부는 응답 객체에 `error` 필드 유무로 판단합니다.

```js
socket.emit('이벤트명', 요청데이터, (response) => {
  if (response.error) {
    console.error(response.error);
    return;
  }
  // 성공 처리
});
```

---

## Client → Server 이벤트

### 1. `join` — 방 입장

세션에 입장합니다. **가장 먼저 호출해야 합니다.**

**요청**
```js
socket.emit('join', {
  sessionId: 1,           // number, Spring Boot 세션 ID
  token: "eyJhbGci..."    // string, Spring Boot 로그인 JWT
}, (response) => { ... });
```

**성공 응답**
```json
{
  "rtpCapabilities": { ... },
  "existingProducers": [
    {
      "producerId": "abc123",
      "peerId": "42",
      "kind": "video"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `rtpCapabilities` | object | mediasoup Router의 RTP 기능 정보. `Device.load()`에 전달 |
| `existingProducers` | array | 이미 방에 있는 참여자의 미디어 목록. 입장 시 바로 구독 처리 |

---

### 2. `createTransport` — WebRTC Transport 생성

미디어 송신용(`send`) 또는 수신용(`recv`) Transport를 생성합니다.

**요청**
```js
socket.emit('createTransport', {
  direction: 'send'  // 'send' | 'recv'
}, (response) => { ... });
```

**성공 응답**
```json
{
  "id": "transport-uuid",
  "iceParameters": { ... },
  "iceCandidates": [ ... ],
  "dtlsParameters": { ... }
}
```

> 카메라/마이크 전송용 `send` 1개, 수신용 `recv` 1개 — 총 2번 호출합니다.

---

### 3. `connectTransport` — Transport 연결

Transport의 DTLS 협상을 완료합니다.

**요청**
```js
socket.emit('connectTransport', {
  transportId: "transport-uuid",
  dtlsParameters: { ... }   // mediasoup-client가 제공하는 값
}, (response) => { ... });
```

**성공 응답**
```json
{ "ok": true }
```

---

### 4. `produce` — 미디어 발행

카메라/마이크 트랙을 서버에 전송하기 시작합니다.

**요청**
```js
socket.emit('produce', {
  transportId: "send-transport-uuid",
  kind: "video",           // 'audio' | 'video'
  rtpParameters: { ... }   // mediasoup-client sendTransport.produce()가 제공하는 값
}, (response) => { ... });
```

**성공 응답**
```json
{ "producerId": "producer-uuid" }
```

> `audio`, `video` 각각 한 번씩 — 총 2번 호출합니다.

---

### 5. `consume` — 미디어 구독

다른 참여자의 미디어를 받기 시작합니다.

**요청**
```js
socket.emit('consume', {
  producerId: "producer-uuid",   // 구독할 상대방의 producerId
  rtpCapabilities: { ... }       // Device.rtpCapabilities
}, (response) => { ... });
```

**성공 응답**
```json
{
  "id": "consumer-uuid",
  "producerId": "producer-uuid",
  "kind": "video",
  "rtpParameters": { ... }
}
```

---

### 6. `resumeConsumer` — Consumer 재개

`consume` 후 반드시 호출해야 미디어가 실제로 흐릅니다.

**요청**
```js
socket.emit('resumeConsumer', {
  consumerId: "consumer-uuid"
}, (response) => { ... });
```

**성공 응답**
```json
{ "ok": true }
```

---

## Server → Client 이벤트

### `newProducer` — 새 참여자 미디어 발행 알림

다른 참여자가 `produce`를 호출하면 나머지 모든 참여자에게 전송됩니다.

```js
socket.on('newProducer', ({ producerId, peerId, kind }) => {
  // 받으면 consume → resumeConsumer 순서로 구독 처리
});
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `producerId` | string | 구독할 때 사용할 producer ID |
| `peerId` | string | 발행자의 memberId (Spring Boot 회원 ID) |
| `kind` | string | `'audio'` \| `'video'` |

---

### `peerLeft` — 참여자 퇴장

```js
socket.on('peerLeft', ({ peerId }) => {
  // 해당 참여자의 비디오/오디오 제거
});
```

---

## 전체 플로우

```
1. Spring Boot  POST /api/auth/login          → JWT 발급
2. Socket.io    emit('join')                  → rtpCapabilities 수신
3.              Device.load(rtpCapabilities)
4.              emit('createTransport', send) → send transport 생성
5.              emit('createTransport', recv) → recv transport 생성
6.              emit('connectTransport', send transport)
7.              emit('connectTransport', recv transport)
8.              emit('produce', video)        → 카메라 발행
9.              emit('produce', audio)        → 마이크 발행
10.             existingProducers 순회 → emit('consume') + emit('resumeConsumer')

참여자 추가 입장 시:
  서버 → emit('newProducer') → emit('consume') + emit('resumeConsumer')

참여자 퇴장 시:
  서버 → emit('peerLeft') → 해당 트랙 제거
```

---

## 에러 코드

| error 메시지 | 원인 |
|---|---|
| `접근 권한이 없습니다.` | JWT가 없거나 세션 참여자가 아님 |
| `유효하지 않은 토큰입니다.` | JWT 파싱 실패 |
| `방에 먼저 입장하세요.` | `join` 없이 다른 이벤트 호출 |
| `존재하지 않는 transport입니다.` | 잘못된 transportId |
| `recv transport가 없습니다.` | `createTransport(recv)` 미호출 상태에서 consume 시도 |
| `미디어를 구독할 수 없습니다.` | 코덱 불일치 |
