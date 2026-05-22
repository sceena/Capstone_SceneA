class Room {
  constructor(roomId, router) {
    this.roomId = roomId;
    this.router = router;
    // peerId -> { socket, sendTransport, recvTransports, producers, consumers }
    this.peers = new Map();
  }

  addPeer(peerId, socket) {
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
