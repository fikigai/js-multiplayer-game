export const FIXED_DT = 1 / 60;
const MAX_FRAME_TIME = 0.25;

export function createLoop({ update, render }) {
	let rafId = null;
	let lastTime = 0;
	let accumulator = 0;

	// Метрики для HUD (оновлюються раз на секунду)
	let statsTimer = 0;
	let framesCount = 0;
	let stepsCount = 0;

	const stats = {
		fps: 0,
		sps: 0,
		frameMs: 0,
	};

	function tick(now) {
		// Перший кадр — просто фіксуємо стартовий час
		if (lastTime === 0) {
			lastTime = now;
		}

		const rawDeltaMs = now - lastTime;
		lastTime = now;

		// Захист від "спіралі смерті" (наприклад, після повернення з іншої вкладки)
		const frameTime = Math.min(rawDeltaMs / 1000, MAX_FRAME_TIME);
		accumulator += frameTime;

		while (accumulator >= FIXED_DT) {
			update(FIXED_DT);
			accumulator -= FIXED_DT;
			stepsCount += 1;
		}

		const alpha = accumulator / FIXED_DT;
		framesCount += 1;
		stats.frameMs = rawDeltaMs;

		statsTimer += rawDeltaMs;
		if (statsTimer >= 1000) {
			stats.fps = Math.round((framesCount * 1000) / statsTimer);
			stats.sps = Math.round((stepsCount * 1000) / statsTimer);
			framesCount = 0;
			stepsCount = 0;
			statsTimer = 0;
		}

		render(alpha, stats);
		rafId = requestAnimationFrame(tick);
	}

	function start() {
		if (rafId !== null) return;
		lastTime = 0;
		accumulator = 0;
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		if (rafId === null) return;
		cancelAnimationFrame(rafId);
		rafId = null;
	}

	return { start, stop };
}
