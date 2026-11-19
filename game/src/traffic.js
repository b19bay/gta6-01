// Traffic: the city's background flow. Cars drive their lanes, slow for the car ahead,
// and respawn at the far side of the map when they drift too far from the player.
// Pedestrians walk the sidewalks, cross at corners, and run when shots ring out.
import { ROADS_X, ROADS_Y, blockedAt } from './city.js';
import { WORLD } from './config.js';
import { createCar, trafficSteer, driveCar } from './vehicles.js';

const TRAFFIC_KINDS = ['sedan', 'taxi', 'pickup', 'van', 'sedan', 'taxi', 'classic'];

export function createTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = horizontal ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const along = rng.range(300, WORLD.w - 300);
    const car = createCar(rng.pick(TRAFFIC_KINDS),
      horizontal ? along : road, horizontal ? road : along,
      horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2));
    car.npc = true;
    car.driver = 'npc';
    car.speed = rng.range(120, 260);
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, player, dt, rng) {
  for (const car of cars) {
    // Slow for the car directly ahead.
    let ahead = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x; const dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      const facing = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (dist < 110 && facing > 0) { ahead = true; break; }
    }
    if (ahead) driveCar(car, 0, 0, dt, true);
    else trafficSteer(car, dt);
    // Too far from the action: recycle to a road near the player.
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > 1500) {
      const horizontal = rng.chance(0.5);
      const road = horizontal ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
      const off = rng.range(-500, 500);
      car.x = horizontal ? player.x + off : road;
      car.y = horizontal ? road : player.y + off;
      car.angle = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      car.speed = rng.range(120, 240);
    }
  }
}

export function createPedestrians(rng, count) {
  const peds = [];
  const names = ['Ana', 'Luis', 'Carmen', 'Diego', 'Sofia', 'Marco', 'Elena', 'Pablo', 'Lucia', 'Jorge'];
  const shirts = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'];
  for (let i = 0; i < count; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = horizontal ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const along = rng.range(300, WORLD.w - 300);
    peds.push({
      id: i,
      name: rng.pick(names),
      x: horizontal ? along : road + (rng.chance(0.5) ? 70 : -70),
      y: horizontal ? road + (rng.chance(0.5) ? 70 : -70) : along,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 75),
      shirt: rng.pick(shirts),
      health: 100,
      state: 'walk', // walk | flee | down
      stateT: 0,
      target: null,
    });
  }
  return peds;
}

export function stepPedestrians(peds, city, player, gunfire, dt, rng) {
  for (const p of peds) {
    p.stateT -= dt;
    if (p.state === 'down') {
      if (p.stateT <= 0) { p.state = 'walk'; p.health = 100; }
      continue;
    }
    if (gunfire && p.state !== 'flee') { p.state = 'flee'; p.stateT = rng.range(2, 4); }
    const dPlayer = Math.hypot(p.x - player.x, p.y - player.y);
    if (p.state === 'flee') {
      const away = Math.atan2(p.y - player.y, p.x - player.x);
      p.angle = away;
      p.x += Math.cos(away) * 170 * dt;
      p.y += Math.sin(away) * 170 * dt;
      if (p.stateT <= 0) p.state = 'walk';
    } else {
      if (p.stateT <= 0 || !p.target) {
        // Pick a new stroll target on a sidewalk a block or two away.
        const horizontal = rng.chance(0.5);
        const road = horizontal ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
        const along = rng.range(300, WORLD.w - 300);
        p.target = horizontal
          ? { x: along, y: road + (rng.chance(0.5) ? 70 : -70) }
          : { x: road + (rng.chance(0.5) ? 70 : -70), y: along };
        p.stateT = rng.range(4, 10);
      }
      const dx = p.target.x - p.x; const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) { p.stateT = 0; continue; }
      p.angle = Math.atan2(dy, dx);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!blockedAt(city, nx, ny)) { p.x = nx; p.y = ny; }
      else p.stateT = 0;
    }
    // Keep pedestrians out of buildings and the sea.
    if (blockedAt(city, p.x, p.y)) { p.x -= Math.cos(p.angle) * 40; p.y -= Math.sin(p.angle) * 40; }
    if (dPlayer < 26 && p.state !== 'flee') { p.state = 'flee'; p.stateT = 1.5; }
  }
}
