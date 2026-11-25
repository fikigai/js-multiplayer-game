import "./style.css";
import { createCollisionSystem } from "./collisions.js";
import { Asteroid, Pickup, Ship } from "./entities.js";
import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createRenderer } from "./render.js";
import { Vector2 } from "./vector2.js";
import { World } from "./world.js";

const canvas = document.getElementById("game");
const renderer = createRenderer(canvas);
const input = createInput(window);
const world = new World(renderer.bounds);

let respawnTimer = null;

function spawnShip() {
	const pos = new Vector2(
		renderer.bounds.width / 2,
		renderer.bounds.height / 2,
	);
	return world.spawn(new Ship({ pos, input }));
}

let playerShip = spawnShip();

const resolveCollisions = createCollisionSystem({
	onShipDestroyed(delaySeconds) {
		playerShip = null;
		respawnTimer = delaySeconds;
	},
});

function initArena() {
	const initialAsteroids = 5;
	for (let i = 0; i < initialAsteroids; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 55 + Math.random() * 80;
		const pos = new Vector2(
			Math.random() * Math.max(renderer.bounds.width, 400),
			Math.random() * Math.max(renderer.bounds.height, 300),
		);
		world.spawn(
			new Asteroid({
				pos,
				vel: Vector2.fromAngle(angle, speed),
				radius: 26 + Math.random() * 12,
				hp: 50,
			}),
		);
	}

	// Стартовий pickup на арені, щоб одразу можна було перевірити композицію
	world.spawn(
		new Pickup({
			pos: new Vector2(
				renderer.bounds.width * 0.25,
				renderer.bounds.height * 0.5,
			),
			healAmount: 35,
			ttl: 30,
		}),
	);
}

initArena();

const loop = createLoop({
	update(dt) {
		if (respawnTimer !== null) {
			respawnTimer -= dt;
			if (respawnTimer <= 0) {
				respawnTimer = null;
				playerShip = spawnShip();
			}
		}

		world.step(dt, resolveCollisions);
	},
	render(alpha, stats) {
		const hudState = {
			score: world.score,
			hp: playerShip.alive ? playerShip.hp : 0,
		};
		renderer.render(world, alpha, stats, hudState);
	},
});

loop.start();
