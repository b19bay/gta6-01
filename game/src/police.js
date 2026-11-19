// The CVPD: wanted level, pursuit, roadblocks and the slow cool-down.
// Crimes add stars; police cars spawn at the edge of view and chase the player,
// ramming on foot or in a car. At 3+ stars they set roadblocks ahead of a fleeing car.
// Hide — no cop in sight for a while — and the heat falls, one star at a time.
import { WANTED } from './config.js';
import { createCar, driveCar } from './vehicles.js';
import { ROADS_X, ROADS_Y } from './city.js';

export function createPolice() {
  return {
    wanted: 0,
    cars: [],        // pursuing police cars
    foot: [],        // officers on foot (spawn at high wanted, near the player)
    roadblocks: [],  // parked police cars used as a wall
    heat: 0,         // 0..1, how recently a crime was seen
    hiddenT: 0,      // seconds with no cop near
    decayT: 0,
    siren: false,
  };
}

export function addWanted(police, n) {
  police.wanted = Math.min(WANTED.max, police.wanted + n);
  police.heat = 1;
  police.hiddenT = 0;
}

function spawnCopCar(police, player, rng) {
  const ang = rng.range(0, Math.PI * 2);
  const dist = rng.range(520, 700);
  const x = player.x + Math.cos(ang) * dist;
  const y = player.y + Math.sin(ang) * dist;
  const car = createCar('police', x, y, Math.atan2(player.y - y, player.x - x));
  car.npc = true;
  car.driver = 'npc';
  police.cars.push(car);
  return car;
}

function spawnRoadblock(police, player, rng) {
  const ahead = player.angle;
  const bx = player.x + Math.cos(ahead) * 520;
  const by = player.y + Math.sin(ahead) * 520;
  const car = createCar('police', bx, by, ahead + Math.PI / 2);
  car.parked = true;
  police.roadblocks.push(car);
  return car;
}

export function stepPolice(police, player, world, dt, rng) {
  const want = WANTED.copsPerStar[police.wanted] || 0;
  // Spawn up to the wanted level's quota.
  while (police.cars.length < want) spawnCopCar(police, player, rng);
  // Extra cars leave when the heat drops.
  while (police.cars.length > want) {
    const car = police.cars.pop();
    world.removeCar(car);
  }
  // Roadblocks at 3+ stars, at most two, refreshed as the player moves.
  if (police.wanted >= WANTED.roadblockFrom) {
    while (police.roadblocks.length < 2) spawnRoadblock(police, player, rng);
  } else {
    for (const rb of police.roadblocks) world.removeCar(rb);
    police.roadblocks = [];
  }

  let nearest = Infinity;
  for (const cop of police.cars) {
    const dx = player.x - cop.x; const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy);
    nearest = Math.min(nearest, d);
    const wantAng = Math.atan2(dy, dx);
    const diff = Math.atan2(Math.sin(wantAng - cop.angle), Math.cos(wantAng - cop.angle));
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    // Cops drive a touch faster than the player at high wanted levels, but after
    // a ram they back off for a beat, so a chase stays a chase and not a pin.
    cop.backoffT = Math.max(0, (cop.backoffT || 0) - dt);
    const throttle = cop.backoffT > 0 ? 0.15 : (police.wanted >= 4 ? 1 : 0.92);
    driveCar(cop, steer, throttle, dt, false);
    // Ram: contact hurts the player, on foot or in a car — at most once per
    // 0.6 s per cop, so a chase wears a car down instead of totalling it at once.
    cop.ramT = Math.max(0, (cop.ramT || 0) - dt);
    if (d < 44 && cop.ramT <= 0) {
      cop.ramT = 1.0;
      cop.backoffT = 0.9;
      if (player.car) {
        player.car.speed *= 0.85;
        player.car.health -= 4;
        if (player.car.health <= 0) {
          player.car.health = 0;
          player.car.parked = true;
          player.car = null;
          cop.speed = 0;
        }
      } else {
        world.hurtPlayer(9);
      }
      cop.speed *= 0.6;
      if (world.audio) world.audio.crash();
    }
    // A wrecked cop car is left behind.
    if (cop.health <= 0) {
      cop.parked = true;
      cop.speed = 0;
      police.cars.splice(police.cars.indexOf(cop), 1);
      world.removeCar(cop);
    }
  }
  // Roadblock cars sit still; hitting one at speed wrecks the player's car.
  for (const rb of police.roadblocks) {
    const d = Math.hypot(rb.x - player.x, rb.y - player.y);
    if (d < 48 && player.car && Math.abs(player.car.speed) > 150) {
      player.car.health -= 40;
      player.car.speed = 0;
      world.audio.crash();
      addWanted(police, 1);
    }
  }
  // Cool-down: no cop near for a while, and the stars fall.
  police.heat = Math.max(0, police.heat - dt * 0.12);
  if (police.wanted > 0 && nearest > 620) {
    police.hiddenT += dt;
    if (police.hiddenT > WANTED.decayDelay) {
      police.decayT += dt;
      if (police.decayT > WANTED.decayStep) {
        police.decayT = 0;
        police.wanted -= 1;
        if (police.wanted === 0) police.hiddenT = 0;
      }
    }
  } else {
    police.hiddenT = 0;
    police.decayT = 0;
  }
  police.siren = police.wanted > 0;
}
