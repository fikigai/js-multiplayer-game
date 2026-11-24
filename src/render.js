function lerp(a, b, alpha) {
	return a + (b - a) * alpha;
}

function lerpWrap(a, b, alpha, max) {
	let diff = b - a;
	if (diff > max / 2) diff -= max;
	if (diff < -max / 2) diff += max;
	return (((a + diff * alpha) % max) + max) % max;
}

export function createRenderer(canvas) {
	const ctx = canvas.getContext("2d");
	const bounds = { width: 0, height: 0 };

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

		// Полум'я двигуна при прискоренні
		if (thrusting) {
			ctx.beginPath();
			ctx.moveTo(-12, -5);
			ctx.lineTo(-24 - Math.random() * 6, 0);
			ctx.lineTo(-12, 5);
			ctx.closePath();
			ctx.fillStyle = "#ff6b35";
			ctx.fill();
		}

		// Корпус корабля (стрілка дивиться вздовж +X)
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

		ctx.restore();
	}

	function drawHud(stats) {
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
		ctx.fillRect(12, 12, 185, 76);

		ctx.font = "13px monospace";
		ctx.fillStyle = "#e0e0e0";
		ctx.fillText(`steps/s:  ${stats.sps}`, 22, 34);
		ctx.fillText(`frames/s: ${stats.fps}`, 22, 54);
		ctx.fillText(`frame:    ${stats.frameMs.toFixed(2)} ms`, 22, 74);
		ctx.restore();
	}

	function render(prevShip, currShip, alpha, stats) {
		ctx.fillStyle = "#121212";
		ctx.fillRect(0, 0, bounds.width, bounds.height);

		drawGrid();

		const x = lerpWrap(prevShip.x, currShip.x, alpha, bounds.width);
		const y = lerpWrap(prevShip.y, currShip.y, alpha, bounds.height);
		const angle = lerp(prevShip.angle, currShip.angle, alpha);

		drawShip(x, y, angle, currShip.thrusting);
		drawHud(stats);
	}

	function destroy() {
		window.removeEventListener("resize", resize);
	}

	return { bounds, render, destroy };
}
