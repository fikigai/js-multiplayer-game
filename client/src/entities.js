import { createHoming, createTtl } from "./behaviors.js";
import { Entity } from "./entity.js";
import { Vector2 } from "./vector2.js";

export const SHIP_CONFIG = {
  turnSpeed: 3.6,
  thrustAccel: 520,
  brakeAccel: 260,
  drag: 0.985,
  maxSpeed: 480,
  radius: 16,
  maxHp: 100,
  fireCooldown: 0.18,
  bulletSpeed: 680,
};

export class Ship extends Entity {
  #hp;
  #maxHp;
  #fireTimer = 0;
  #shotCount = 0;

  constructor({ pos, maxHp = SHIP_CONFIG.maxHp, input = null, bus = null }) {
    super({
      pos,
      vel: new Vector2(0, 0),
      radius: SHIP_CONFIG.radius,
      kind: "ship",
      angle: -Math.PI / 2,
      wrapBounds: true,
    });
    this.#maxHp = maxHp;
    this.#hp = maxHp;
    this.input = input;
    this.bus = bus;
  }

  get hp() {
    return this.#hp;
  }

  get maxHp() {
    return this.#maxHp;
  }

  takeDamage(amount) {
    if (!this.alive || amount <= 0) return;
    this.#hp = Math.max(0, this.#hp - amount);
  }

  heal(amount) {
    if (!this.alive || amount <= 0) return;
    this.#hp = Math.min(this.#maxHp, this.#hp + amount);
  }

  fire(world) {
    if (!this.alive || !world || this.#fireTimer > 0) return null;

    this.#fireTimer = SHIP_CONFIG.fireCooldown;
    this.#shotCount += 1;

    const noseOffset = Vector2.fromAngle(this.angle, this.radius + 8);
    const spawnPos = this.pos.add(noseOffset);
    const bulletVel = Vector2.fromAngle(
      this.angle,
      SHIP_CONFIG.bulletSpeed,
    ).add(this.vel.scale(0.25));

    const isHoming = this.#shotCount % 3 === 0;
    const behaviors = [createTtl(1.1)];
    if (isHoming) {
      behaviors.push(
        createHoming({
          targetKind: "asteroid",
          turnRate: 5.5,
          speed: SHIP_CONFIG.bulletSpeed,
        }),
      );
    }

    const bullet = new Bullet({
      pos: spawnPos,
      vel: bulletVel,
      angle: this.angle,
      ownerId: this.id,
      homing: isHoming,
      behaviors,
    });

    world.spawn(bullet);
    this.bus?.emit("fired", { shipId: this.id, homing: isHoming });
    return bullet;
  }

  update(dt, world) {
    if (this.#fireTimer > 0) {
      this.#fireTimer = Math.max(0, this.#fireTimer - dt);
    }

    const state = this.input ? this.input.getState() : null;
    if (state) {
      if (state.turnLeft) this.angle -= SHIP_CONFIG.turnSpeed * dt;
      if (state.turnRight) this.angle += SHIP_CONFIG.turnSpeed * dt;

      const forward = Vector2.fromAngle(this.angle);
      if (state.thrust) {
        this.vel = this.vel.add(forward.scale(SHIP_CONFIG.thrustAccel * dt));
      } else if (state.brake) {
        this.vel = this.vel.sub(forward.scale(SHIP_CONFIG.brakeAccel * dt));
      }

      if (state.fire) {
        this.fire(world);
      }
    }

    const damping = SHIP_CONFIG.drag ** (dt * 60);
    this.vel = this.vel.scale(damping);

    const speed = this.vel.length();
    if (speed > SHIP_CONFIG.maxSpeed) {
      this.vel = this.vel.scale(SHIP_CONFIG.maxSpeed / speed);
    }

    super.update(dt, world);
  }
}

export class Bullet extends Entity {
  constructor({
    pos,
    vel,
    angle = 0,
    ownerId = null,
    damage = 25,
    homing = false,
    behaviors = [],
  }) {
    super({
      pos,
      vel,
      radius: 4,
      kind: "bullet",
      angle,
      wrapBounds: true,
      behaviors,
    });
    this.ownerId = ownerId;
    this.damage = damage;
    this.homing = homing;
  }
}

export class Asteroid extends Entity {
  constructor({
    pos,
    vel,
    radius = 28,
    hp = 50,
    rotSpeed = 0.8,
    behaviors = [],
  }) {
    super({
      pos,
      vel,
      radius,
      kind: "asteroid",
      angle: Math.random() * Math.PI * 2,
      wrapBounds: true,
      behaviors,
    });
    this.hp = hp;
    this.rotSpeed = rotSpeed;
  }

  update(dt, world) {
    this.angle += this.rotSpeed * dt;
    super.update(dt, world);
  }
}

export class Particle extends Entity {
  constructor({ pos, vel, radius = 3, color = "#ff9f1c", ttl = 0.45 }) {
    super({
      pos,
      vel,
      radius,
      kind: "particle",
      wrapBounds: false,
      behaviors: [createTtl(ttl)],
    });
    this.color = color;
    this.ttl = ttl;
    this.life = ttl;
  }

  update(dt, world) {
    this.life = Math.max(0, this.life - dt);
    this.vel = this.vel.scale(0.95 ** (dt * 60));
    super.update(dt, world);
  }
}

export class Pickup extends Entity {
  constructor({ pos, healAmount = 35, ttl = 10 }) {
    super({
      pos,
      vel: new Vector2(0, 0),
      radius: 12,
      kind: "pickup",
      wrapBounds: true,
      behaviors: [createTtl(ttl)],
    });
    this.healAmount = healAmount;
  }
}
