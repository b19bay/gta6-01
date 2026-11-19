// Dario Cruz: on foot and behind the wheel.
// On foot he walks, runs, punches and shoots. In a car he drives it; stealing a car
// that has a driver (or a witness watching) is a crime, and the police notice.
import { PLAYER } from './config.js';
import { carContains, driveCar } from './vehicles.js';
import { resolveCollision } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: 250,
    ammo: PLAYER.pistolStartAmmo,
    hasPistol: true,
    car: null,          // the car he is driving, or null
    punchT: 0,
    shootT: 0,
    hurtT: 0,
    dead: false,
  };
}

export function hurtPlayer(player, dmg) {
  if (player.dead || player.hurtT > 0.4) return;
  player.health -= dmg;
  player.hurtT = 0.8;
  if (player.health <= 0) { player.health = 0; player.dead = true; }
}

/**
 * Step the player for one tick. Returns events: { stole, entered, exited, punched, shot }.
 * `world` gives access to cars, peds, police, city, missions and the crime callback.
 */
export function stepPlayer(player, input, world, actions, dt) {
  const ev = { stole: null, entered: false, exited: false, punched: null, shot: null };
  const mv = input.move();
  player.punchT = Math.max(0, player.punchT - dt);
  player.shootT = Math.max(0, player.shootT - dt);
  player.hurtT = Math.max(0, player.hurtT - dt);
  if (player.dead) return ev;

  if (player.car) {
    const car = player.car;
    const steer = mv.x;
    const throttle = mv.y < 0 ? 1 : mv.y > 0 ? -0.7 : 0;
    const brake = input.runHeld();
    driveCar(car, steer, throttle, dt, brake);
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    // Bumping a pedestrian at speed is a crime, and it hurts.
    for (const p of world.peds) {
      if (p.state === 'down') continue;
      if (Math.hypot(p.x - car.x, p.y - car.y) < 34 && Math.abs(car.speed) > 120) {
        p.health = 0; p.state = 'down'; p.stateT = 5;
        world.onCrime('hitPed', 1);
        world.audio.crash();
      }
    }
    // Ramming another car at speed wrecks it a little at a time (0.5 s between
    // hits, so one shove never totals a car). Ramming a police car is a crime.
    for (const other of world.cars) {
      if (other === car || other.health <= 0) continue;
      if (Math.hypot(other.x - car.x, other.y - car.y) < 48 && Math.abs(car.speed) > 150) {
        if (!other.hitT || other.hitT <= 0) {
          other.hitT = 0.5;
          other.health -= 18;
          if (other.health <= 0) {
            other.health = 0; other.parked = true; other.speed = 0;
            world.burst(other.x, other.y, '#ff6b35', 22);
          }
          if (other.police) world.onCrime('ramCop', 1);
          world.audio.crash();
          car.speed *= 0.6;
        }
      }
    }
    if (actions & 4) { // E: get out
      const side = car.angle + Math.PI / 2;
      player.x = car.x + Math.cos(side) * 40;
      player.y = car.y + Math.sin(side) * 40;
      car.driver = null;
      player.car = null;
      ev.exited = true;
    }
    return ev;
  }

  // On foot.
  const speed = input.runHeld() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (mv.x !== 0 || mv.y !== 0) {
    const len = Math.hypot(mv.x, mv.y);
    const nx = player.x + (mv.x / len) * speed * dt;
    const ny = player.y + (mv.y / len) * speed * dt;
    player.x = nx; player.y = ny;
    player.angle = Math.atan2(mv.y, mv.x);
    resolveCollision(world.city, player, PLAYER.radius);
  }
  // E: steal / enter the nearest car.
  if (actions & 4) {
    let best = null; let bd = 90;
    for (const car of world.cars) {
      if (car.police || car.health <= 0) continue; // a wreck is not a ride
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      const hadDriver = best.driver === 'npc';
      best.driver = 'player';
      best.parked = false;
      player.car = best;
      ev.entered = true;
      if (hadDriver || best.kind === 'police') {
        ev.stole = best;
        world.onCrime('stealCar', 1);
      }
    }
  }
  // F: punch the nearest person.
  if ((actions & 8) && player.punchT <= 0) {
    player.punchT = PLAYER.punchCooldown;
    let best = null; let bd = PLAYER.punchRange + 14;
    const targets = [...world.peds, ...world.policeFoot];
    for (const t of targets) {
      if (t.state === 'down') continue;
      const d = Math.hypot(t.x - player.x, t.y - player.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) {
      best.health -= PLAYER.punchDamage;
      if (best.health <= 0) { best.state = 'down'; best.stateT = 5; }
      if (best.isCop) world.onCrime('assaultCop', 1);
      ev.punched = best;
      world.audio.punch();
    }
  }
  // Mouse click: shoot toward the cursor.
  if ((actions & 16) && player.shootT <= 0 && player.ammo > 0) {
    player.shootT = PLAYER.pistolCooldown;
    player.ammo -= 1;
    const m = input.mouse();
    const wx = world.camera.x + (m.x - world.view.w / 2) / world.zoom;
    const wy = world.camera.y + (m.y - world.view.h / 2) / world.zoom;
    const ang = Math.atan2(wy - player.y, wx - player.x);
    player.angle = ang;
    ev.shot = { angle: ang, from: { x: player.x, y: player.y } };
    world.audio.shoot();
    world.onCrime('shoot', 1);
    world.gunfire = 0.6;
  }
  return ev;
}
