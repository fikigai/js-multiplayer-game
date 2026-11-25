import { Vector2 } from "./vector2.js";

function wrap(value, max) {
	if (max <= 0) return value;
	return ((value % max) + max) % max;
}

export class Entity {
	static #nextId = 1;
	#id;

	constructor({
		pos = new Vector2(0, 0),
		vel = new Vector2(0, 0),
		radius = 10,
		kind = "entity",
		angle = 0,
		wrapBounds = true,
		behaviors = [],
	} = {}) {
		this.#id = Entity.#nextId++;
		this.pos = pos.clone();
		this.prevPos = pos.clone();
		this.vel = vel.clone();
		this.radius = radius;
		this.kind = kind;
		this.angle = angle;
		this.prevAngle = angle;
		this.wrapBounds = wrapBounds;
		this.behaviors = behaviors;
		this.alive = true;
	}

	get id() {
		return this.#id;
	}

	savePrevState() {
		this.prevPos = this.pos.clone();
		this.prevAngle = this.angle;
	}

	update(dt, world) {
		for (const behavior of this.behaviors) {
			behavior(this, dt, world);
		}

		this.pos = this.pos.add(this.vel.scale(dt));

		if (this.wrapBounds && world.bounds.width > 0 && world.bounds.height > 0) {
			this.pos = new Vector2(
				wrap(this.pos.x, world.bounds.width),
				wrap(this.pos.y, world.bounds.height),
			);
		}
	}
}
