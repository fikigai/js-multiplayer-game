export class GameSocketClient extends EventTarget {
  constructor({ url, reconnectBaseMs = 400, reconnectMaxMs = 5000 } = {}) {
    super();
    this.url = url;
    this.reconnectBaseMs = reconnectBaseMs;
    this.reconnectMaxMs = reconnectMaxMs;

    this.ws = null;
    this.queue = [];
    this.joinedPayload = null;
    this.closedIntentionally = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
  }

  connect(joinPayload = null) {
    if (joinPayload) {
      this.joinedPayload = joinPayload;
    }
    this.closedIntentionally = false;
    this._clearReconnectTimer();
    this._openSocket();
  }

  disconnect() {
    this.closedIntentionally = true;
    this._clearReconnectTimer();
    this.queue = [];
    if (this.ws) {
      try {
        this.ws.close(1000, "Client disconnect");
      } catch {
        // ігноруємо
      }
      this.ws = null;
    }
  }

  send(message) {
    const serialized = JSON.stringify(message);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else {
      this.queue.push(serialized);
    }
  }

  sendChat(text) {
    const clean = text.trim();
    if (!clean) return;
    this.send({ type: "chat", text: clean });
  }

  _flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      this.ws.send(item);
    }
  }

  _openSocket() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.dispatchEvent(new CustomEvent("open"));
      if (this.joinedPayload) {
        ws.send(
          JSON.stringify({
            type: "join",
            ...this.joinedPayload,
          }),
        );
      }
      this._flushQueue();
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(String(event.data));
        this.dispatchEvent(new CustomEvent("message", { detail: data }));
      } catch {
        // ігноруємо невалідний кадр
      }
    });

    ws.addEventListener("close", (event) => {
      this.dispatchEvent(
        new CustomEvent("close", {
          detail: { code: event.code, reason: event.reason },
        }),
      );
      if (!this.closedIntentionally) {
        this._scheduleReconnect();
      }
    });

    ws.addEventListener("error", () => {
      this.dispatchEvent(new CustomEvent("error"));
    });
  }

  _scheduleReconnect() {
    this._clearReconnectTimer();
    const delay = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * 2 ** this.reconnectAttempts,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      if (!this.closedIntentionally) {
        this._openSocket();
      }
    }, delay);
  }

  _clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
