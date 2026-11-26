import { Asteroid, Particle, Pickup, Ship } from "./entities.js";
import { Vector2 } from "./vector2.js";

function circlesOverlap(a, b) {
  return a.alive && b.alive && a.pos.distanceTo(b.pos) < a.radius + b.radius;
}

export function spawnExplosion(world, pos, color = "#ff9f1c", count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const speed = 60 + Math.random() * 190;
    world.spawn(
      new Particle({
        pos,
        vel: Vector2.fromAngle(angle, speed),
        radius: 2 + Math.random() * 2.5,
        color,
        ttl: 0.35 + Math.random() * 0.3,
      }),
    );
  }
}

export function createCollisionSystem({ onShipDestroyed }) {
  function randomEdgePos(bounds) {
    const w = Math.max(bounds.width, 200);
    const h = Math.max(bounds.height, 200);
    if (Math.random() < 0.5) {
      return new Vector2(Math.random() < 0.5 ? 20 : w - 20, Math.random() * h);
    }
    return new Vector2(Math.random() * w, Math.random() < 0.5 ? 20 : h - 20);
  }

  function spawnReplacementAsteroid(world) {
    const pos = randomEdgePos(world.bounds);
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 85;
    const radius = 22 + Math.random() * 14;
    world.spawn(
      new Asteroid({
        pos,
        vel: Vector2.fromAngle(angle, speed),
        radius,
        hp: 50,
      }),
    );
  }

  return function resolveCollisions(world) {
    const list = [...world.entities.values()].filter(
      (e) => e.alive && e.kind !== "particle",
    );

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!circlesOverlap(a, b)) continue;

        // 1. Куля <-> Астероїд
        if (a.kind === "bullet" && b.kind === "asteroid") {
          handleBulletHitAsteroid(world, a, b);
        } else if (b.kind === "bullet" && a.kind === "asteroid") {
          handleBulletHitAsteroid(world, b, a);
        }

        // 2. Куля <-> Корабель
        else if (a.kind === "bullet" && b.kind === "ship") {
          handleBulletHitShip(world, a, b);
        } else if (b.kind === "bullet" && a.kind === "ship") {
          handleBulletHitShip(world, b, a);
        }

        // 3. Корабель <-> Pickup
        else if (a.kind === "ship" && b.kind === "pickup") {
          handleShipPickup(world, a, b);
        } else if (b.kind === "ship" && a.kind === "pickup") {
          handleShipPickup(world, b, a);
        }

        // 4. Корабель <-> Астероїд
        else if (a.kind === "ship" && b.kind === "asteroid") {
          handleShipHitAsteroid(world, a, b);
        } else if (b.kind === "ship" && a.kind === "asteroid") {
          handleShipHitAsteroid(world, b, a);
        }
      }
    }
  };

  function handleBulletHitAsteroid(world, bullet, asteroid) {
    world.despawn(bullet);
    asteroid.hp -= bullet.damage;
    spawnExplosion(world, bullet.pos, "#ffd166", 6);

    if (asteroid.hp <= 0) {
      world.despawn(asteroid);
      world.score += 100;
      spawnExplosion(world, asteroid.pos, "#ff6b35", 18);
      spawnReplacementAsteroid(world);

      if (Math.random() < 0.35) {
        world.spawn(new Pickup({ pos: asteroid.pos, healAmount: 35 }));
      }
    }
  }

  function handleBulletHitShip(world, bullet, ship) {
    if (bullet.ownerId === ship.id) return;
    world.despawn(bullet);
    ship.takeDamage(bullet.damage);
    spawnExplosion(world, bullet.pos, "#ef476f", 8);

    if (ship.hp <= 0) {
      destroyShip(world, ship);
    }
  }

  function handleShipHitAsteroid(world, ship, asteroid) {
    world.despawn(asteroid);
    spawnReplacementAsteroid(world);
    ship.takeDamage(35);
    spawnExplosion(world, ship.pos, "#ff6b35", 16);

    if (ship.hp <= 0) {
      destroyShip(world, ship);
    }
  }

  function handleShipPickup(world, ship, pickup) {
    ship.heal(pickup.healAmount);
    world.despawn(pickup);
    world.score += 25;
    spawnExplosion(world, pickup.pos, "#1db954", 10);
  }

  function destroyShip(world, ship) {
    if (!(ship instanceof Ship) || !ship.alive) return;
    world.despawn(ship);
    spawnExplosion(world, ship.pos, "#ef476f", 26);
    if (onShipDestroyed) {
      onShipDestroyed(2.0); // респаун через 2 секунди
    }
  }
}
