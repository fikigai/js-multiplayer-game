function lerp(a, b, alpha) {
	return a + (b - a) * alpha;
}

function lerpWrap(a, b, alpha, max) {
	if (max <= 0) return b;
	let diff = b - a;
	if (diff > max / 2) diff -= max;
	if (diff < -max / 2) diff += max;
	return (((a + diff * alpha) % max) + max) % max;
}

export function createRenderer(canvas, { sprites = {} } = {}) {
	const ctx = canvas.getContext("2d");
	const bounds = { width: 0, height: 0 };
	let currentSprites = { ...sprites };

	function resize() {
		const dpr = window.devicePixelRatio || 1;
		const width = window.innerWidth;
		const height = window.innerHeight;

		bounds.width = width;
		bounds.height = height;

		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	resize();
	window.addEventListener("resize", resize);

	function setSprites(nextSprites = {}) {
		currentSprites = { ...currentSprites, ...nextSprites };
	}

	function hasSprite(key) {
		const img = currentSprites[key];
		Boolean(img?.complete && img.naturalWidth > 0);
	}

	function getInterpPos(entity, alpha) {
		if (!entity.wrapBounds) {
			return {
				x: lerp(entity.prevPos.x, entity.pos.x, alpha),
				y: lerp(entity.prevPos.y, entity.pos.y, alpha),
				angle: lerp(entity.prevAngle, entity.angle, alpha),
			};
		}

		return {
			x: lerpWrap(entity.prevPos.x, entity.pos.x, alpha, bounds.width),
			y: lerpWrap(entity.prevPos.y, entity.pos.y, alpha, bounds.height),
			angle: lerp(entity.prevAngle, entity.angle, alpha),
		};
	}

	function drawGrid() {
		const step = 48;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
		ctx.lineWidth = 1;
		ctx.beginPath();

		for (let x = 0; x <= bounds.width; x += step) {
			ctx.moveTo(x, 0);
			ctx.lineTo(x, bounds.height);
		}
		for (let y = 0; y <= bounds.height; y += step) {
			ctx.moveTo(0, y);
			ctx.lineTo(bounds.width, y);
		}
		ctx.stroke();
	}

	function drawShip(x, y, angle, thrusting) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);

		if (thrusting) {
			ctx.beginPath();
			ctx.moveTo(-12, -5);
			ctx.lineTo(-24 - Math.random() * 6, 0);
			ctx.lineTo(-12, 5);
			ctx.closePath();
			ctx.fillStyle = "#ff6b35";
			ctx.fill();
		}

		if (hasSprite("ship")) {
			const size = 40;
			ctx.drawImage(currentSprites.ship, -size / 2, -size / 2, size, size);
		} else {
			ctx.beginPath();
			ctx.moveTo(18, 0);
			ctx.lineTo(-12, -11);
			ctx.lineTo(-7, 0);
			ctx.lineTo(-12, 11);
			ctx.closePath();

			ctx.fillStyle = "#1db954";
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#e8f5e9";
			ctx.stroke();
		}

		ctx.restore();
	}

	function drawAsteroid(entity, x, y, angle) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);

		if (hasSprite("asteroid")) {
			const size = entity.radius * 2.2;
			ctx.drawImage(currentSprites.asteroid, -size / 2, -size / 2, size, size);
		} else {
			const sides = 8;
			ctx.beginPath();
			for (let i = 0; i < sides; i++) {
				const a = (Math.PI * 2 * i) / sides;
				const r = entity.radius * (i % 2 === 0 ? 1 : 0.78);
				const px = Math.cos(a) * r;
				const py = Math.sin(a) * r;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();

			ctx.fillStyle = "#2b2d42";
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#8d99ae";
			ctx.stroke();
		}

		ctx.restore();
	}

	function drawBullet(entity, x, y) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(entity.angle);

		if (!entity.homing && hasSprite("bullet")) {
			const size = entity.radius * 4;
			ctx.drawImage(currentSprites.bullet, -size / 2, -size / 2, size, size);
		} else {
			ctx.beginPath();
			ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
			ctx.fillStyle = entity.homing ? "#ffbe0b" : "#4cc9f0";
			ctx.fill();
		}

		ctx.restore();
	}

	function drawPickup(entity, x, y) {
		ctx.save();
		ctx.translate(x, y);

		ctx.beginPath();
		ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(29, 185, 84, 0.22)";
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = "#1db954";
		ctx.stroke();

		ctx.strokeStyle = "#e8f5e9";
		ctx.beginPath();
		ctx.moveTo(-5, 0);
		ctx.lineTo(5, 0);
		ctx.moveTo(0, -5);
		ctx.lineTo(0, 5);
		ctx.stroke();

		ctx.restore();
	}

	function drawParticle(entity, x, y) {
		const alpha = entity.ttl > 0 ? entity.life / entity.ttl : 0;
		ctx.save();
		ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
		ctx.beginPath();
		ctx.arc(x, y, entity.radius, 0, Math.PI * 2);
		ctx.fillStyle = entity.color;
		ctx.fill();
		ctx.restore();
	}

	function drawHud(stats, hudState) {
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
		ctx.fillRect(12, 12, 225, 116);

		ctx.font = "13px monospace";
		ctx.fillStyle = "#e0e0e0";
		ctx.fillText(`steps/s:  ${stats.sps}`, 22, 34);
		ctx.fillText(`frames/s: ${stats.fps}`, 22, 52);
		ctx.fillText(`frame:    ${stats.frameMs.toFixed(2)} ms`, 22, 70);
		ctx.fillStyle = "#1db954";
		ctx.fillText(`score:    ${hudState.score}`, 22, 92);
		ctx.fillStyle = hudState.hp > 30 ? "#e8f5e9" : "#ef476f";
		ctx.fillText(`hp:       ${hudState.hp}`, 22, 112);
		ctx.restore();
	}

	function renderLoading(
		{ ratio = 0, completed = 0, total = 0 } = {},
		label = "Loading assets...",
	) {
		ctx.fillStyle = "#121212";
		ctx.fillRect(0, 0, bounds.width, bounds.height);
		drawGrid();

		const barWidth = Math.min(420, Math.max(220, bounds.width * 0.45));
		const barHeight = 20;
		const x = (bounds.width - barWidth) / 2;
		const y = (bounds.height - barHeight) / 2;
		const clamped = Math.max(0, Math.min(1, ratio));

		ctx.save();
		ctx.font = "16px monospace";
		ctx.fillStyle = "#e8f5e9";
		ctx.textAlign = "center";
		ctx.fillText(label, bounds.width / 2, y - 24);

		ctx.font = "13px monospace";
		ctx.fillStyle = "#a0a0a0";
		ctx.fillText(
			`${Math.round(clamped * 100)}% (${completed}/${total})`,
			bounds.width / 2,
			y + barHeight + 24,
		);

		ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
		ctx.fillRect(x, y, barWidth, barHeight);

		ctx.fillStyle = "#1db954";
		ctx.fillRect(x, y, barWidth * clamped, barHeight);

		ctx.strokeStyle = "#1db954";
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x, y, barWidth, barHeight);
		ctx.restore();
	}

	function render(world, alpha, stats, hudState) {
		ctx.fillStyle = "#121212";
		ctx.fillRect(0, 0, bounds.width, bounds.height);

		drawGrid();

		for (const entity of world) {
			if (!entity.alive) continue;
			const { x, y, angle } = getInterpPos(entity, alpha);

			if (entity.kind === "asteroid") {
				drawAsteroid(entity, x, y, angle);
			} else if (entity.kind === "bullet") {
				drawBullet(entity, x, y);
			} else if (entity.kind === "pickup") {
				drawPickup(entity, x, y);
			} else if (entity.kind === "particle") {
				drawParticle(entity, x, y);
			} else if (entity.kind === "ship") {
				drawShip(x, y, angle, Boolean(entity.input?.getState().thrust));
			}
		}

		drawHud(stats, hudState);
	}

	function destroy() {
		window.removeEventListener("resize", resize);
	}

	return { bounds, setSprites, renderLoading, render, destroy };
}
