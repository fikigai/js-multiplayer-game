export class World {
	constructor(bounds) {
		this.bounds = bounds;
		this.entities = new Map();
		this.score = 0;
	}

	spawn(entity) {
		this.entities.set(entity.id, entity);
		return entity;
	}

	despawn(entityOrId) {
		const entity =
			typeof entityOrId === "number"
				? this.entities.get(entityOrId)
				: entityOrId;
		if (entity) {
			entity.alive = false;
		}
	}

	sweep() {
		for (const [id, entity] of this.entities) {
			if (!entity.alive) {
				this.entities.delete(id);
			}
		}
	}

	*[Symbol.iterator]() {
		yield* this.entities.values();
	}

	*ofKind(kind) {
		for (const entity of this.entities.values()) {
			if (entity.alive && entity.kind === kind) {
				yield entity;
			}
		}
	}

	step(dt, resolveCollisions) {
		const snapshot = [...this.entities.values()];

		for (const entity of snapshot) {
			if (entity.alive) {
				entity.savePrevState();
			}
		}

		for (const entity of snapshot) {
			if (entity.alive) {
				entity.update(dt, this);
			}
		}

		if (resolveCollisions) {
			resolveCollisions(this);
		}

		this.sweep();
	}
}
