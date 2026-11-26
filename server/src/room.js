import { EventEmitter } from "node:events";

export class Room extends EventEmitter {
  constructor({ id, name, arena = { asteroids: 5, pickupHeal: 35 } }) {
    super();
    this.id = id;
    this.name = name;
    this.arena = arena;
    this.clients = new Map();
  }

  get size() {
    return this.clients.size;
  }

  addClient(clientId, meta) {
    this.clients.set(clientId, meta);
    const event = {
      type: "player_joined",
      roomId: this.id,
      clientId,
      playerName: meta.playerName,
      playersCount: this.clients.size,
      ts: new Date().toISOString(),
    };
    this.emit("log", event);
    this.emit("broadcast", {
      type: "system",
      roomId: this.id,
      text: `${meta.playerName} joined the room`,
      playersCount: this.clients.size,
      ts: event.ts,
    });
  }

  removeClient(clientId, reason = "left") {
    const meta = this.clients.get(clientId);
    if (!meta) return false;

    this.clients.delete(clientId);
    const event = {
      type: "player_left",
      roomId: this.id,
      clientId,
      playerName: meta.playerName,
      reason,
      playersCount: this.clients.size,
      ts: new Date().toISOString(),
    };
    this.emit("log", event);
    this.emit("broadcast", {
      type: "system",
      roomId: this.id,
      text: `${meta.playerName} left (${reason})`,
      playersCount: this.clients.size,
      ts: event.ts,
    });

    if (this.clients.size === 0) {
      this.emit("empty", this.id);
    }
    return true;
  }

  postChat(clientId, text) {
    const meta = this.clients.get(clientId);
    if (!meta) {
      this.emit(
        "error",
        new Error(`Client ${clientId} not in room ${this.id}`),
      );
      return null;
    }

    const msg = {
      type: "chat",
      roomId: this.id,
      from: meta.playerName,
      text,
      ts: new Date().toISOString(),
    };
    this.emit("log", { ...msg, clientId });
    this.emit("broadcast", msg);
    return msg;
  }
}
