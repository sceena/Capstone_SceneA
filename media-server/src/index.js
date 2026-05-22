const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const axios = require('axios');
const config = require('./config');
const Room = require('./Room');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.server.corsOrigins,
    credentials: true,
  },
});

// roomId(sessionId) -> Room
const rooms = new Map();
const workers = [];
let workerIdx = 0;

async function createWorkers() {
  for (let i = 0; i < config.mediasoup.numWorkers; i++) {
    const worker = await mediasoup.createWorker(config.mediasoup.workerSettings);
    worker.on('died', () => {
      console.error('mediasoup worker died');
      process.exit(1);
    });
    workers.push(worker);
  }
  console.log(`mediasoup workers: ${workers.length}개 생성`);
}

function getNextWorker() {
  const worker = workers[workerIdx];
  workerIdx = (workerIdx + 1) % workers.length;
  return worker;
}

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const worker = getNextWorker();
  const router = await worker.createRouter(config.mediasoup.routerOptions);
  const room = new Room(roomId, router);
  rooms.set(roomId, room);
  return room;
}

async function validateAccess(sessionId, token) {
  if (process.env.SKIP_AUTH === 'true') return true;
  try {
    const res = await axios.get(
      `${config.server.springBootUrl}/api/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

function getMemberIdFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return String(payload.sub);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Socket.io 이벤트
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentPeerId = null;

  // 1. 방 입장
  socket.on('join', async ({ sessionId, token }, callback) => {
    try {
      const isValid = await validateAccess(sessionId, token);
      if (!isValid) return callback({ error: '접근 권한이 없습니다.' });

      const peerId = getMemberIdFromToken(token);
      if (!peerId) return callback({ error: '유효하지 않은 토큰입니다.' });

      const room = await getOrCreateRoom(String(sessionId));
      room.addPeer(peerId, socket);
      currentRoom = room;
      currentPeerId = peerId;

      const existingProducers = room.getExistingProducers(peerId);

      callback({
        rtpCapabilities: room.router.rtpCapabilities,
        existingProducers, // 이미 방에 있는 참여자의 producer 목록
      });
    } catch (err) {
      console.error('join error:', err);
      callback({ error: '서버 오류가 발생했습니다.' });
    }
  });

  // 2. WebRTC Transport 생성
  socket.on('createTransport', async ({ direction }, callback) => {
    if (!currentRoom || !currentPeerId) return callback({ error: '방에 먼저 입장하세요.' });
    try {
      const transport = await currentRoom.router.createWebRtcTransport(
        config.mediasoup.webRtcTransportOptions
      );
      const peer = currentRoom.getPeer(currentPeerId);

      if (direction === 'send') {
        peer.sendTransport = transport;
      } else {
        peer.recvTransports.set(transport.id, transport);
      }

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // 3. Transport DTLS 연결
  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    if (!currentRoom || !currentPeerId) return callback({ error: '방에 먼저 입장하세요.' });
    try {
      const peer = currentRoom.getPeer(currentPeerId);
      const transport =
        peer.sendTransport?.id === transportId
          ? peer.sendTransport
          : peer.recvTransports.get(transportId);

      if (!transport) return callback({ error: '존재하지 않는 transport입니다.' });

      await transport.connect({ dtlsParameters });
      callback({ ok: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // 4. 미디어 발행 (카메라/마이크 → 서버)
  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    if (!currentRoom || !currentPeerId) return callback({ error: '방에 먼저 입장하세요.' });
    try {
      const peer = currentRoom.getPeer(currentPeerId);
      if (!peer.sendTransport || peer.sendTransport.id !== transportId) {
        return callback({ error: '유효하지 않은 send transport입니다.' });
      }

      const producer = await peer.sendTransport.produce({ kind, rtpParameters });
      peer.producers.set(producer.id, producer);

      // 다른 참여자에게 새 producer 알림
      currentRoom.getOtherPeers(currentPeerId).forEach(({ socket: otherSocket }) => {
        otherSocket.emit('newProducer', {
          producerId: producer.id,
          peerId: currentPeerId,
          kind,
        });
      });

      callback({ producerId: producer.id });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // 5. 미디어 구독 (서버 → 클라이언트)
  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    if (!currentRoom || !currentPeerId) return callback({ error: '방에 먼저 입장하세요.' });
    try {
      if (!currentRoom.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: '미디어를 구독할 수 없습니다.' });
      }

      const peer = currentRoom.getPeer(currentPeerId);
      const recvTransport = [...peer.recvTransports.values()][0];
      if (!recvTransport) return callback({ error: 'recv transport가 없습니다.' });

      const consumer = await recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // resumeConsumer 호출 전까지 일시정지
      });
      peer.consumers.set(consumer.id, consumer);

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // 6. Consumer 재개 (consume 후 반드시 호출)
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    if (!currentRoom || !currentPeerId) return callback({ error: '방에 먼저 입장하세요.' });
    try {
      const peer = currentRoom.getPeer(currentPeerId);
      const consumer = peer.consumers.get(consumerId);
      if (!consumer) return callback({ error: '존재하지 않는 consumer입니다.' });

      await consumer.resume();
      callback({ ok: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    if (!currentRoom || !currentPeerId) return;

    currentRoom.getOtherPeers(currentPeerId).forEach(({ socket: otherSocket }) => {
      otherSocket.emit('peerLeft', { peerId: currentPeerId });
    });

    currentRoom.removePeer(currentPeerId);
    if (currentRoom.isEmpty()) rooms.delete(currentRoom.roomId);
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function main() {
  await createWorkers();
  httpServer.listen(config.server.port, () => {
    console.log(`media-server running on port ${config.server.port}`);
  });
}

main().catch(console.error);
