const TRACKED_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
]);

export function createInput(target = window) {
  const pressed = new Set();

  function onKeyDown(event) {
    if (TRACKED_CODES.has(event.code)) {
      event.preventDefault();
      pressed.add(event.code);
    }
  }

  function onKeyUp(event) {
    pressed.delete(event.code);
  }

  function onBlur() {
    pressed.clear();
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  function getState() {
    return {
      thrust: pressed.has("KeyW") || pressed.has("ArrowUp"),
      brake: pressed.has("KeyS") || pressed.has("ArrowDown"),
      turnLeft: pressed.has("KeyA") || pressed.has("ArrowLeft"),
      turnRight: pressed.has("KeyD") || pressed.has("ArrowRight"),
      fire: pressed.has("Space"),
    };
  }

  function destroy() {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", onBlur);
    pressed.clear();
  }

  return { getState, destroy };
}
