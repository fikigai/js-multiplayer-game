export function createChatView(
  socketClient,
  { container = document.body } = {},
) {
  const box = document.createElement("div");
  box.id = "room-chat-box";
  box.style.cssText = `
    position: fixed;
    right: 14px;
    bottom: 14px;
    width: min(320px, calc(100vw - 28px));
    background: rgba(20, 22, 27, 0.9);
    border: 1px solid #2e323b;
    border-radius: 6px;
    padding: 10px;
    font-family: monospace;
    color: #e8f5e9;
    z-index: 15;
    display: none;
    flex-direction: column;
    gap: 8px;
  `;

  box.innerHTML = `
    <div id="chat-header" style="font-size: 12px; color: #1db954; font-weight: bold;">Room Chat</div>
    <div id="chat-messages" style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-size: 12px;"></div>
    <form id="chat-form" style="display: flex; gap: 6px;">
      <input id="chat-input" type="text" maxlength="240" placeholder="Type message..." style="flex: 1; padding: 6px 8px; background: #121212; color: #fff; border: 1px solid #3a3f4b; border-radius: 4px; font-family: monospace; font-size: 12px;" />
      <button type="submit" style="padding: 6px 10px; background: #1db954; color: #0c0e10; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 12px;">Send</button>
    </form>
  `;

  container.appendChild(box);

  const headerEl = box.querySelector("#chat-header");
  const messagesEl = box.querySelector("#chat-messages");
  const formEl = box.querySelector("#chat-form");
  const inputEl = box.querySelector("#chat-input");

  function appendLine(text, color = "#e8f5e9") {
    const line = document.createElement("div");
    line.style.color = color;
    line.textContent = text;
    messagesEl.appendChild(line);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const val = inputEl.value.trim();
    if (!val) return;
    socketClient.sendChat(val);
    inputEl.value = "";
  };

  const onMessage = (e) => {
    const data = e.detail;
    if (data.type === "chat") {
      appendLine(`[${data.from}]: ${data.text}`, "#e8f5e9");
    } else if (data.type === "system") {
      appendLine(`* ${data.text}`, "#90e0ef");
    }
  };

  const onOpen = () => {
    appendLine("* Connected to server", "#1db954");
  };

  const onClose = () => {
    appendLine("* Disconnected, retrying...", "#ffb703");
  };

  formEl.addEventListener("submit", onSubmit);
  socketClient.addEventListener("message", onMessage);
  socketClient.addEventListener("open", onOpen);
  socketClient.addEventListener("close", onClose);

  return {
    show(roomTitle = "Room Chat") {
      headerEl.textContent = `Chat — ${roomTitle}`;
      box.style.display = "flex";
    },
    hide() {
      box.style.display = "none";
    },
    destroy() {
      formEl.removeEventListener("submit", onSubmit);
      socketClient.removeEventListener("message", onMessage);
      socketClient.removeEventListener("open", onOpen);
      socketClient.removeEventListener("close", onClose);
      box.remove();
    },
  };
}
