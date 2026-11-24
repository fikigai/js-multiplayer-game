export const SHIP_CONFIG = {
	turnSpeed: 3.6, // рад/с
	thrustAccel: 520, // пікс/с²
	brakeAccel: 260, // пікс/с²
	drag: 0.985, // гасіння швидкості за тік (60 Гц)
	maxSpeed: 480, // пікс/с
	radius: 16,
};

export function createShip(x, y) {
	return {
		x,
		y,
		vx: 0,
		vy: 0,
		angle: -Math.PI / 2, // дивиться вгору
		thrusting: false,
	};
}

function wrap(value, max) {
	if (max <= 0) return value;
	return ((value % max) + max) % max;
}

export function integrate(ship, input, dt, bounds) {
	let { x, y, vx, vy, angle } = ship;

	// 1. Поворот
	if (input.turnLeft) angle -= SHIP_CONFIG.turnSpeed * dt;
	if (input.turnRight) angle += SHIP_CONFIG.turnSpeed * dt;

	// 2. Прискорення / гальмування
	if (input.thrust) {
		vx += Math.cos(angle) * SHIP_CONFIG.thrustAccel * dt;
		vy += Math.sin(angle) * SHIP_CONFIG.thrustAccel * dt;
	} else if (input.brake) {
		vx -= Math.cos(angle) * SHIP_CONFIG.brakeAccel * dt;
		vy -= Math.sin(angle) * SHIP_CONFIG.brakeAccel * dt;
	}

	// 3. Опір середовища (незалежний від dt)
	const damping = SHIP_CONFIG.drag ** (dt * 60);
	vx *= damping;
	vy *= damping;

	// 4. Обмеження максимальної швидкості
	const speed = Math.hypot(vx, vy);
	if (speed > SHIP_CONFIG.maxSpeed) {
		const scale = SHIP_CONFIG.maxSpeed / speed;
		vx *= scale;
		vy *= scale;
	}

	// 5. Оновлення позиції + загортання країв арени
	x = wrap(x + vx * dt, bounds.width);
	y = wrap(y + vy * dt, bounds.height);

	return {
		x,
		y,
		vx,
		vy,
		angle,
		thrusting: input.thrust,
	};
}
