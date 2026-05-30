class Room {
  constructor(roomId, router) {
    this.roomId = roomId;
    this.router = router;
    // peerId -> { socket, sendTransport, recvTransports, producers, consumers }
    this.peers = new Map();
    this.activeQuestion = null;
  }

  addPeer(peerId, socket) {
    // 재접속 시 기존 리소스 정리
    if (this.peers.has(peerId)) {
      const existing = this.peers.get(peerId);
      if (existing.sendTransport) existing.sendTransport.close();
      existing.recvTransports.forEach((t) => t.close());
    }
    this.peers.set(peerId, {
      socket,
      sendTransport: null,
      recvTransports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.sendTransport) peer.sendTransport.close();
    peer.recvTransports.forEach((t) => t.close());
    this.peers.delete(peerId);
  }

  getPeer(peerId) {
    return this.peers.get(peerId);
  }

  getOtherPeers(peerId) {
    const others = [];
    for (const [id, peer] of this.peers) {
      if (id !== peerId) others.push({ peerId: id, socket: peer.socket });
    }
    return others;
  }

  // 새 참여자에게 기존 producer 목록 알려주기 위해
  getExistingProducers(excludePeerId) {
    const producers = [];
    for (const [peerId, peer] of this.peers) {
      if (peerId === excludePeerId) continue;
      for (const [producerId, producer] of peer.producers) {
        producers.push({ producerId, peerId, kind: producer.kind });
      }
    }
    return producers;
  }

  isEmpty() {
    return this.peers.size === 0;
  }
}

module.exports = Room;
