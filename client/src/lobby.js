import { fetchJson } from "./assets.js";

export class Lobby extends EventTarget {
  constructor({
    url = "/api/rooms",
    pollIntervalMs = 5000,
    requestTimeoutMs = 3000,
  } = {}) {
    super();
    this.url = url;
    this.pollIntervalMs = pollIntervalMs;
    this.requestTimeoutMs = requestTimeoutMs;

    this.rooms = [];
    this.selectedRoomId = null;
    this.playerName = "Pilot";
    this.visible = false;
    this.loading = false;
    this.error = null;

    this._pollTimer = null;
    this._activeController = null;
  }

  open() {
    if (this.visible) return;
    this.visible = true;
    this._emitChange();
    this.refresh();

    this._pollTimer = setInterval(() => {
      if (this.visible) {
        this.refresh();
      }
    }, this.pollIntervalMs);
  }

  close() {
    this.visible = false;
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.abortInFlight();
    this._emitChange();
  }

  abortInFlight() {
    if (this._activeController) {
      this._activeController.abort(
        new DOMException("Lobby closed", "AbortError"),
      );
      this._activeController = null;
    }
  }

  setPlayerName(name) {
    this.playerName = name.trim() || "Pilot";
    this._emitChange();
  }

  selectRoom(roomId) {
    this.selectedRoomId = roomId;
    this._emitChange();
  }

  async refresh() {
    if (!this.visible) return;
    this.abortInFlight();

    const controller = new AbortController();
    this._activeController = controller;

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const signal = AbortSignal.any([controller.signal, timeoutSignal]);

    this.loading = true;
    this.error = null;
    this._emitChange();

    try {
      const data = await fetchJson(this.url, { signal });
      if (!this.visible || controller.signal.aborted) return;

      this.rooms = Array.isArray(data?.rooms) ? data.rooms : [];
      if (
        this.rooms.length > 0 &&
        !this.rooms.some((r) => r.id === this.selectedRoomId)
      ) {
        this.selectedRoomId = this.rooms[0].id;
      }
      this.loading = false;
      this.error = null;
      this._emitChange();
    } catch (err) {
      if (controller.signal.aborted && !timeoutSignal.aborted) {
        return;
      }
      this.loading = false;
      this.error =
        err?.name === "TimeoutError"
          ? "Rooms request timed out"
          : err?.message || "Failed to load rooms";
      this._emitChange();
    } finally {
      if (this._activeController === controller) {
        this._activeController = null;
      }
    }
  }

  join() {
    const room = this.rooms.find((r) => r.id === this.selectedRoomId) ??
      this.rooms[0] ?? {
        id: "local-default",
        name: "Local Arena",
        arena: { asteroids: 5, pickupHeal: 35 },
      };

    this.close();
    this.dispatchEvent(
      new CustomEvent("join", {
        detail: {
          playerName: this.playerName,
          room,
        },
      }),
    );
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          visible: this.visible,
          rooms: this.rooms,
          selectedRoomId: this.selectedRoomId,
          playerName: this.playerName,
          loading: this.loading,
          error: this.error,
        },
      }),
    );
  }
}
