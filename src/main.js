import "./style.css";
import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createShip, integrate } from "./physics.js";
import { createRenderer } from "./render.js";

const canvas = document.getElementById("game");
const renderer = createRenderer(canvas);
const input = createInput(window);

let prevShip = createShip(
	renderer.bounds.width / 2,
	renderer.bounds.height / 2,
);
let currShip = { ...prevShip };

const loop = createLoop({
	update(dt) {
		prevShip = currShip;
		currShip = integrate(currShip, input.getState(), dt, renderer.bounds);
	},
	render(alpha, stats) {
		renderer.render(prevShip, currShip, alpha, stats);
	},
});

loop.start();
