export class SoundSystem {
  constructor() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = AudioCtx ? new AudioCtx() : null;
    this.buffers = new Map();
    this.unlocked = false;
  }

  setBuffers(audioMap = {}) {
    this.buffers.clear();
    for (const [name, buf] of Object.entries(audioMap)) {
      if (buf) {
        this.buffers.set(name, buf);
      }
    }
  }

  async unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Ігноруємо, якщо браузер ще чекає жесту користувача
      }
    }
    this.unlocked = this.ctx.state === "running";
  }

  play(name, { volume = 0.25 } = {}) {
    if (this.ctx?.state !== "running") return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  attachBus(bus) {
    const onFired = () => this.play("fired", { volume: 0.18 });
    const onHit = () => this.play("hit", { volume: 0.25 });
    const onExploded = () => this.play("exploded", { volume: 0.35 });

    bus.addEventListener("fired", onFired);
    bus.addEventListener("hit", onHit);
    bus.addEventListener("exploded", onExploded);

    return () => {
      bus.removeEventListener("fired", onFired);
      bus.removeEventListener("hit", onHit);
      bus.removeEventListener("exploded", onExploded);
    };
  }
}
