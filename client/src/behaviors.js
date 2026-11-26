import { Vector2 } from "./vector2.js";

export function createTtl(seconds) {
  let remaining = seconds;

  return function ttlBehavior(entity, dt, world) {
    remaining -= dt;
    if (remaining <= 0) {
      world.despawn(entity);
    }
  };
}

export function createHoming({ targetKind, turnRate = 3.5, speed = 420 } = {}) {
  return function homingBehavior(entity, dt, world) {
    let nearest = null;
    let minDist = Number.POSITIVE_INFINITY;

    for (const candidate of world.ofKind(targetKind)) {
      const dist = entity.pos.distanceTo(candidate.pos);
      if (dist < minDist) {
        minDist = dist;
        nearest = candidate;
      }
    }

    if (!nearest) return;

    const desired = nearest.pos.sub(entity.pos);
    const targetAngle = Math.atan2(desired.y, desired.x);

    // Найкоротший кут повороту в межах [-PI, PI]
    let diff = targetAngle - entity.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxStep = turnRate * dt;
    const step = Math.max(-maxStep, Math.min(maxStep, diff));

    entity.angle += step;
    entity.vel = Vector2.fromAngle(entity.angle, speed);
  };
}
