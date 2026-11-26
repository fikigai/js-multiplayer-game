import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { loadConfig } from "./config.js";
import { MatchLogStream } from "./match-log.js";
import { Room } from "./room.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, "../../client/dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
};

const config = loadConfig();
const matchLog = new MatchLogStream(config.logsDir);
const rooms = new Map();

function createRoom({ id, name, arena }) {
  const room = new Room({
    id,
    name,
    arena: arena ?? { asteroids: 5, pickupHeal: 35 },
  });

  room.on("log", (entry) => {
    matchLog.writeEvent(entry);
  });

  room.on("broadcast", (payload) => {
    const raw = JSON.stringify(payload);
    for (const [clientId, client] of room.clients.entries()) {
      const ws = client.ws;
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > 64 * 1024) continue;
      ws.send(raw, (err) => {
        if (err) {
          room.removeClient(clientId, "send_error");
        }
      });
    }
  });

  room.on("empty", (emptyRoomId) => {
    rooms.delete(emptyRoomId);
    matchLog.writeEvent({
      type: "room_deleted",
      roomId: emptyRoomId,
      ts: new Date().toISOString(),
    });
  });

  room.on("error", (err) => {
    console.error(`[room:${room.id}] error:`, err.message);
  });

  rooms.set(room.id, room);
  return room;
}

createRoom({
  id: "sector-alpha",
  name: "Sector Alpha — Classic Arena",
  arena: { asteroids: 5, pickupHeal: 35 },
});
createRoom({
  id: "nebula-rush",
  name: "Nebula Rush — Dense Asteroids",
  arena: { asteroids: 9, pickupHeal: 45 },
});

function serializeRooms() {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    players: r.size,
    maxPlayers: 4,
    arena: r.arena,
  }));
}

function readJsonBody(req, limitBytes = 4096) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function serveStaticClient(req, res, pathname) {
  if (pathname.includes("..") || decodeURIComponent(pathname).includes("..")) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden path");
    return;
  }

  const relPath =
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(clientDistDir, relPath);
  const rootWithSep = clientDistDir.endsWith(path.sep)
    ? clientDistDir
    : `${clientDistDir}${path.sep}`;

  if (resolved !== clientDistDir && !resolved.startsWith(rootWithSep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden path");
    return;
  }

  let targetFile = resolved;
  if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    const fallbackIndex = path.join(clientDistDir, "index.html");
    if (req.method === "GET" && fs.existsSync(fallbackIndex)) {
      targetFile = fallbackIndex;
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
  }

  const ext = path.extname(targetFile);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
  });
  fs.createReadStream(targetFile).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || "/";
  if (rawUrl.includes("..")) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const parsedUrl = new URL(rawUrl, `http://127.0.0.1:${config.port}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      rooms: rooms.size,
      uptime: process.uptime(),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/rooms") {
    sendJson(res, 200, { rooms: serializeRooms() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/rooms") {
    try {
      const body = await readJsonBody(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 40) {
        sendJson(res, 400, { error: "Room name must be 1..40 characters" });
        return;
      }
      const id =
        typeof body.id === "string" && /^[a-z0-9-]+$/i.test(body.id.trim())
          ? body.id.trim().toLowerCase()
          : `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

      const room = createRoom({
        id,
        name,
        arena: body.arena,
      });

      sendJson(res, 201, {
        room: {
          id: room.id,
          name: room.name,
          players: room.size,
          maxPlayers: 4,
          arena: room.arena,
        },
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/replay") {
    try {
      await matchLog.streamReplay(res);
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: err.message });
      }
    }
    return;
  }

  serveStaticClient(req, res, pathname);
});

const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: config.maxPayloadBytes,
});

let nextClientSeq = 1;

wss.on("connection", (ws) => {
  const clientId = `c-${nextClientSeq++}`;
  let joinedRoom = null;
  let missedPongs = 0;
  let msgTimestamps = [];

  const joinTimer = setTimeout(() => {
    if (!joinedRoom) {
      ws.close(4001, "Join timeout");
    }
  }, 5000);

  ws.on("pong", () => {
    missedPongs = 0;
  });

  ws.on("message", (rawData) => {
    const byteLength = Buffer.isBuffer(rawData)
      ? rawData.length
      : Buffer.byteLength(String(rawData));
    if (byteLength > config.maxPayloadBytes) {
      ws.close(1009, "Message too large");
      return;
    }

    const now = Date.now();
    msgTimestamps = msgTimestamps.filter((ts) => now - ts < 1000);
    msgTimestamps.push(now);
    if (msgTimestamps.length > 15) {
      ws.close(1008, "Rate limit exceeded");
      return;
    }

    let msg;
    try {
      msg = JSON.parse(rawData.toString("utf8"));
    } catch {
      ws.close(1008, "Invalid JSON");
      return;
    }

    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
      ws.close(1008, "Invalid message shape");
      return;
    }

    if (msg.type === "pong") {
      missedPongs = 0;
      return;
    }

    if (msg.type === "join") {
      if (joinedRoom) {
        ws.close(1008, "Already joined");
        return;
      }
      const roomId = typeof msg.roomId === "string" ? msg.roomId.trim() : "";
      const playerName =
        typeof msg.playerName === "string" && msg.playerName.trim()
          ? msg.playerName.trim().slice(0, 20)
          : "Pilot";

      const room = rooms.get(roomId);
      if (!room) {
        ws.close(1008, "Unknown room");
        return;
      }

      clearTimeout(joinTimer);
      joinedRoom = room;
      room.addClient(clientId, { playerName, ws });

      ws.send(
        JSON.stringify({
          type: "joined",
          clientId,
          room: {
            id: room.id,
            name: room.name,
            arena: room.arena,
          },
        }),
      );
      return;
    }

    if (msg.type === "chat") {
      if (!joinedRoom) {
        ws.close(1008, "Join required before chat");
        return;
      }
      if (typeof msg.text !== "string") {
        ws.close(1008, "Invalid chat payload");
        return;
      }
      const cleanText = msg.text.trim();
      if (!cleanText || cleanText.length > 240) {
        ws.close(1008, "Invalid chat length");
        return;
      }
      joinedRoom.postChat(clientId, cleanText);
      return;
    }

    ws.close(1008, `Unknown message type: ${msg.type}`);
  });

  ws.on("close", (code, reason) => {
    clearTimeout(joinTimer);
    if (joinedRoom) {
      joinedRoom.removeClient(clientId, `close_${code || 1000}`);
      joinedRoom = null;
    }
    void reason;
  });

  ws.on("error", (err) => {
    clearTimeout(joinTimer);
    console.error(`[ws:${clientId}] error:`, err.message);
  });

  ws._incMissedPongs = () => {
    missedPongs += 1;
    return missedPongs;
  };
});

const pingInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const misses = client._incMissedPongs();
    if (misses > 2) {
      client.terminate();
      continue;
    }
    client.ping();
  }
}, 15_000);

async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  clearInterval(pingInterval);

  for (const client of wss.clients) {
    try {
      client.close(1001, "Server shutting down");
    } catch {
      client.terminate();
    }
  }

  await new Promise((resolve) => {
    wss.close(() => resolve());
  });

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  await matchLog.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(
    `Server listening on http://localhost:${config.port} (logsDir: ${config.logsDir})`,
  );
});
