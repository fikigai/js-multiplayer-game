import "./style.css";
import { loadAll } from "./assets.js";
import { SoundSystem } from "./audio.js";
import { createChatView } from "./chat-view.js";
import { createCollisionSystem } from "./collisions.js";
import { Asteroid, Pickup, Ship } from "./entities.js";
import { GameBus } from "./events.js";
import { createInput } from "./input.js";
import { createLobbyView } from "./lobby-view.js";
import { Lobby } from "./lobby.js";
import { createLoop } from "./loop.js";
import { createRenderer } from "./render.js";
import { GameSocketClient } from "./socket-client.js";
import { Vector2 } from "./vector2.js";
import { World } from "./world.js";

const canvas = document.getElementById("game");
const bus = new GameBus();
const sound = new SoundSystem();
const renderer = createRenderer(canvas);
const input = createInput(window);
const world = new World(renderer.bounds);

let respawnTimer = null;
let playerShip = null;
let gameStarted = false;
let currentRoom = null;
let currentPlayerName = "Pilot";
let loadState = { ratio: 0, completed: 0, total: 0, message: "Preparing..." };
let loadError = null;
let activeLoadController = null;

function createRetryButton() {
  const btn = document.createElement("button");
  btn.id = "retry-load-btn";
  btn.type = "button";
  btn.textContent = "Retry";
  btn.style.cssText = `
    position: fixed;
    left: 50%;
    top: calc(50% + 56px);
    transform: translateX(-50%);
    z-index: 25;
    display: none;
    padding: 8px 18px;
    background: #ef476f;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-family: monospace;
    font-weight: bold;
    cursor: pointer;
  `;
  document.body.appendChild(btn);
  return btn;
}

const retryBtn = createRetryButton();

function updateRetryButton() {
  retryBtn.style.display = !gameStarted && loadError ? "block" : "none";
}

function spawnShip() {
  const pos = new Vector2(
    renderer.bounds.width / 2,
    renderer.bounds.height / 2,
  );
  return world.spawn(new Ship({ pos, input, bus }));
}

const resolveCollisions = createCollisionSystem({
  bus,
  onShipDestroyed(delaySeconds) {
    playerShip = null;
    respawnTimer = delaySeconds;
  },
});

function clearWorldEntities() {
  for (const entity of [...world]) {
    world.despawn(entity);
  }
  world.sweep();
  world.score = 0;
  respawnTimer = null;
  playerShip = null;
}

function startArena(roomConfig, playerName) {
  currentRoom = roomConfig;
  currentPlayerName = playerName;
  clearWorldEntities();

  const arena = roomConfig?.arena ?? {};
  const asteroidCount = Math.max(1, Number(arena.asteroids ?? 5));
  const pickupHeal = Number(arena.pickupHeal ?? 35);

  playerShip = spawnShip();

  for (let i = 0; i < asteroidCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 80;
    const pos = new Vector2(
      Math.random() * Math.max(renderer.bounds.width, 400),
      Math.random() * Math.max(renderer.bounds.height, 300),
    );
    world.spawn(
      new Asteroid({
        pos,
        vel: Vector2.fromAngle(angle, speed),
        radius: 26 + Math.random() * 12,
        hp: 50,
      }),
    );
  }

  world.spawn(
    new Pickup({
      pos: new Vector2(
        renderer.bounds.width * 0.25,
        renderer.bounds.height * 0.5,
      ),
      healAmount: pickupHeal,
      ttl: 30,
    }),
  );

  gameStarted = true;
  updateRetryButton();
}

const lobby = new Lobby({
  url: "/api/rooms",
  pollIntervalMs: 5000,
  requestTimeoutMs: 3000,
});

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socketClient = new GameSocketClient({
  url: `${wsProtocol}//${window.location.host}/ws`,
});
const chatView = createChatView(socketClient);

lobby.addEventListener("join", (event) => {
  const { playerName, room } = event.detail;
  startArena(room, playerName);
  chatView.show(room.name);
  socketClient.connect({
    roomId: room.id,
    playerName,
  });
});

createLobbyView(lobby);

lobby.addEventListener("join", (event) => {
  const { playerName, room } = event.detail;
  startArena(room, playerName);
});

sound.attachBus(bus);

function unlockAudioOnGesture() {
  sound.unlock();
}

window.addEventListener("pointerdown", unlockAudioOnGesture, { passive: true });
window.addEventListener("keydown", unlockAudioOnGesture, { passive: true });

async function runAssetPipeline() {
  if (activeLoadController) {
    activeLoadController.abort(new DOMException("Restarted", "AbortError"));
  }
  const controller = new AbortController();
  activeLoadController = controller;

  loadError = null;
  gameStarted = false;
  loadState = {
    ratio: 0,
    completed: 0,
    total: 0,
    message: "Loading manifest & assets...",
  };
  updateRetryButton();

  try {
    const assets = await loadAll({
      manifestUrl: "/manifest.json",
      audioCtx: sound.ctx,
      signal: controller.signal,
      onProgress(progress) {
        loadState = {
          ratio: progress.ratio,
          completed: progress.completed,
          total: progress.total,
          message:
            progress.status === "loaded" && progress.lastItem
              ? `Loaded ${progress.lastItem.key}`
              : "Loading assets...",
        };
      },
    });

    if (controller.signal.aborted) return;

    renderer.setSprites(assets.images);
    sound.setBuffers(assets.audio);
    loadError = null;
    updateRetryButton();
    lobby.open();
  } catch (err) {
    if (controller.signal.aborted && activeLoadController !== controller) {
      return;
    }
    loadError = err?.message || "Asset loading failed";
    loadState = {
      ...loadState,
      message: `Error: ${loadError}`,
    };
    updateRetryButton();
  } finally {
    if (activeLoadController === controller) {
      activeLoadController = null;
    }
  }
}

retryBtn.addEventListener("click", () => {
  runAssetPipeline();
});

window.addEventListener("pagehide", () => {
  lobby.close();
  activeLoadController?.abort(new DOMException("Page hidden", "AbortError"));
});

const loop = createLoop({
  update(dt) {
    if (!gameStarted) return;

    if (respawnTimer !== null) {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        respawnTimer = null;
        playerShip = spawnShip();
      }
    }

    world.step(dt, resolveCollisions);
  },
  render(alpha, stats) {
    if (!gameStarted) {
      renderer.renderLoading(loadState, loadState.message);
      return;
    }

    const hudState = {
      score: world.score,
      hp: playerShip?.alive ? playerShip.hp : 0,
      playerName: currentPlayerName,
      roomName: currentRoom?.name ?? "",
    };
    renderer.render(world, alpha, stats, hudState);
  },
});

loop.start();
runAssetPipeline();
