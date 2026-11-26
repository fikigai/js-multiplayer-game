export function createLobbyView(lobby, { container = document.body } = {}) {
	const root = document.createElement("div");
	root.id = "lobby-overlay";
	root.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(10, 12, 14, 0.85);
    z-index: 20;
    font-family: monospace;
    color: #e8f5e9;
  `;

	root.innerHTML = `
    <div style="width: min(440px, 92vw); background: #181a1f; border: 1px solid #1db954; border-radius: 8px; padding: 20px; box-sizing: border-box;">
      <h2 style="margin: 0 0 14px; font-size: 18px; color: #1db954;">Game Lobby</h2>
      <label style="display: block; margin-bottom: 12px; font-size: 13px;">
        Pilot name:
        <input id="lobby-name-input" type="text" maxlength="20" style="width: 100%; margin-top: 6px; padding: 8px; background: #121212; color: #fff; border: 1px solid #333; border-radius: 4px; box-sizing: border-box;" />
      </label>
      <div style="margin-bottom: 8px; font-size: 13px;">Rooms:</div>
      <div id="lobby-rooms-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;"></div>
      <div id="lobby-status" style="min-height: 18px; font-size: 12px; color: #ffb703; margin-bottom: 12px;"></div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="lobby-refresh-btn" type="button" style="padding: 8px 12px; background: #262930; color: #e8f5e9; border: 1px solid #444; border-radius: 4px; cursor: pointer;">Refresh</button>
        <button id="lobby-join-btn" type="button" style="padding: 8px 16px; background: #1db954; color: #0b0d0e; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Join</button>
      </div>
    </div>
  `;

	container.appendChild(root);

	const nameInput = root.querySelector("#lobby-name-input");
	const roomsList = root.querySelector("#lobby-rooms-list");
	const statusEl = root.querySelector("#lobby-status");
	const refreshBtn = root.querySelector("#lobby-refresh-btn");
	const joinBtn = root.querySelector("#lobby-join-btn");

	nameInput.value = lobby.playerName;

	const onInput = () => lobby.setPlayerName(nameInput.value);
	const onRefresh = () => lobby.refresh();
	const onJoin = () => lobby.join();

	nameInput.addEventListener("input", onInput);
	refreshBtn.addEventListener("click", onRefresh);
	joinBtn.addEventListener("click", onJoin);

	function renderState(state) {
		root.style.display = state.visible ? "flex" : "none";
		if (!state.visible) return;

		if (document.activeElement !== nameInput) {
			nameInput.value = state.playerName;
		}

		if (state.loading) {
			statusEl.style.color = "#90e0ef";
			statusEl.textContent = "Fetching /api/rooms...";
		} else if (state.error) {
			statusEl.style.color = "#ef476f";
			statusEl.textContent = `Error: ${state.error}`;
		} else {
			statusEl.style.color = "#8d99ae";
			statusEl.textContent = "Auto-refresh active";
		}

		roomsList.innerHTML = "";
		for (const room of state.rooms) {
			const btn = document.createElement("button");
			btn.type = "button";
			const selected = room.id === state.selectedRoomId;
			btn.style.cssText = `
        text-align: left;
        padding: 10px;
        background: ${selected ? "rgba(29, 185, 84, 0.18)" : "#121212"};
        border: 1px solid ${selected ? "#1db954" : "#2e323b"};
        border-radius: 4px;
        color: #e8f5e9;
        cursor: pointer;
        font-family: monospace;
        font-size: 12px;
      `;
			btn.textContent = `${room.name} (${room.players}/${room.maxPlayers}) — asteroids: ${room.arena?.asteroids ?? 5}`;
			btn.addEventListener("click", () => lobby.selectRoom(room.id));
			roomsList.appendChild(btn);
		}
	}

	const onChange = (e) => renderState(e.detail);
	lobby.addEventListener("change", onChange);
	renderState({
		visible: lobby.visible,
		rooms: lobby.rooms,
		selectedRoomId: lobby.selectedRoomId,
		playerName: lobby.playerName,
		loading: lobby.loading,
		error: lobby.error,
	});

	return {
		destroy() {
			nameInput.removeEventListener("input", onInput);
			refreshBtn.removeEventListener("click", onRefresh);
			joinBtn.removeEventListener("click", onJoin);
			lobby.removeEventListener("change", onChange);
			root.remove();
		},
	};
}
