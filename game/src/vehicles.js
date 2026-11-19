// Cars: one arcade model for the player, traffic and police alike.
// A car has a heading, a speed, and a drift factor; steering bites harder the faster
// you go, and the car slides a little sideways when you throw it around a corner.
import { CARS } from './config.js';
import { isOnRoad, nearestRoadPoint } from './city.js';

let nextId = 1;

export function createCar(kind, x, y, angle) {
  const def = CARS[kind];
  return {
    id: nextId += 1,
    kind, def,
    x, y, angle: angle || 0,
    speed: 0,
    color: def.color,
    parked: false,
    npc: false,          // true for traffic cars the AI drives
    police: kind === 'police',
    driver: null,        // 'player' | 'npc' | null (empty parked car)
    health: 100,
    stuck: 0,
  };
}

/** Arcade drive step. steer in [-1, 1], throttle in [-1, 1]. Returns distance moved. */
export function driveCar(car, steer, throttle, dt, brake) {
  const def = car.def;
  const forward = throttle >= 0 ? throttle : throttle * 0.7;
  car.speed += forward * def.accel * dt;
  if (brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed *= Math.max(0, 1 - 0.35 * dt); // rolling drag
  if (car.speed > def.top) car.speed = def.top;
  if (car.speed < -def.top * 0.45) car.speed = -def.top * 0.45;
  const spd = Math.abs(car.speed);
  const grip = def.grip * Math.min(1, spd / 120 + 0.25);
  car.angle += steer * grip * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, spd / 90 + 0.15);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  return Math.abs(car.speed) * dt;
}

/** Point-in-rotated-rectangle test, for stealing and bumping. */
export function carContains(car, x, y) {
  const dx = x - car.x; const dy = y - car.y;
  const c = Math.cos(-car.angle); const s = Math.sin(-car.angle);
  const lx = dx * c - dy * s; const ly = dx * s + dy * c;
  return Math.abs(lx) < car.def.len / 2 + 6 && Math.abs(ly) < car.def.wid / 2 + 6;
}

export function carSpeedKmh(car) { return Math.round(Math.abs(car.speed) * 0.32); }

/** Push overlapping cars apart so traffic never drives through itself. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d; const ny = dy / d;
        if (!a.parked) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.parked) { b.x += nx * push; b.y += ny * push; }
      }
    }
  }
}

/** Keep a car on the road grid when it is traffic: snap back to the nearest lane. */
export function trafficSteer(car, dt) {
  const rp = nearestRoadPoint(car.x, car.y);
  const want = rp.horizontal ? 0 : Math.PI / 2;
  // Pick the lane direction that keeps the car moving forward.
  let target = want;
  const diff = Math.atan2(Math.sin(target - car.angle), Math.cos(target - car.angle));
  const diff2 = Math.atan2(Math.sin(target + Math.PI - car.angle), Math.cos(target + Math.PI - car.angle));
  const steer = Math.abs(diff) < Math.abs(diff2) ? diff : diff2;
  const clamped = Math.max(-1, Math.min(1, steer * 2.2));
  driveCar(car, clamped, 0.55, dt, false);
  if (!isOnRoad(car.x, car.y)) {
    // Wandered off the grid (a shove): steer back toward the road centre.
    const back = Math.atan2(rp.y - car.y, rp.x - car.x);
    const bdiff = Math.atan2(Math.sin(back - car.angle), Math.cos(back - car.angle));
    driveCar(car, Math.max(-1, Math.min(1, bdiff * 2)), 0.4, dt, false);
  }
}
