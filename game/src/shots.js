// Screenshot scenes: each one plays the real rules forward from a fresh world for
// a fixed number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like — and the same seed always gives the same frame.
// ?shot=cover|foot|drive|mission (with &seed=N) stages that scene, paints it twice
// and sets window.__shotReady for the screenshot tool.
import { STEP } from './config.js';
import { PLACES, ROADS_X, ROADS_Y } from './city.js';
import { createCar } from './vehicles.js';
import { SCREEN_PLAY } from './render.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function nearest(list, v) {
  let best = list[0]; let bd = Infinity;
  for (const x of list) { const d = Math.abs(x - v); if (d < bd) { bd = d; best = x; } }
  return best;
}

/**
 * A route along the road grid: down one road, then along the next, so the driver
 * never cuts across blocks. From (px,py) to (tx,ty): travel the nearer road first.
 */
function roadRoute(from, to) {
  const rx = nearest(ROADS_X, to.x);
  const ry = nearest(ROADS_Y, to.y);
  const prx = nearest(ROADS_X, from.x);
  const pry = nearest(ROADS_Y, from.y);
  if (Math.abs(from.y - pry) <= Math.abs(from.x - prx)) {
    return [{ x: rx, y: pry }, { x: rx, y: to.y }];
  }
  return [{ x: prx, y: ry }, { x: to.x, y: ry }];
}

/** A driver that follows the road route toward a (possibly moving) target. */
function makeDriver(world, targetFn) {
  let route = null;
  let routeIdx = 0;
  let anchor = null;
  let stillT = 0;
  let reverseT = 0;
  let lastX = 0; let lastY = 0;
  return {
    move() {
      const p = world.player;
      const t = targetFn();
      if (!anchor || Math.hypot(t.x - anchor.x, t.y - anchor.y) > 250) {
        route = roadRoute({ x: p.x, y: p.y }, t);
        routeIdx = 0;
        anchor = { x: t.x, y: t.y };
      }
      let goal = t;
      if (route && routeIdx < route.length) {
        goal = route[routeIdx];
        if (Math.hypot(p.x - goal.x, p.y - goal.y) < 70) {
          routeIdx += 1;
          if (routeIdx < route.length) goal = route[routeIdx];
          else goal = t;
        }
      }
      if (p.car) {
        const car = p.car;
        const moved = Math.hypot(car.x - lastX, car.y - lastY);
        lastX = car.x; lastY = car.y;
        if (Math.abs(car.speed) < 40) stillT += STEP;
        else stillT = 0;
        if (stillT > 0.9) { reverseT = 0.8; stillT = 0; }
        const want = Math.atan2(goal.y - car.y, goal.x - car.x);
        const diff = Math.atan2(Math.sin(want - car.angle), Math.cos(want - car.angle));
        let steer = clamp(diff * 2.2, -1, 1);
        let y = -1;
        if (reverseT > 0) {
          reverseT -= STEP;
          y = 1; steer = -steer;
        }
        return { x: steer, y };
      }
      // On foot: walk toward the goal.
      const dx = goal.x - p.x; const dy = goal.y - p.y;
      return {
        x: Math.abs(dx) > 12 ? Math.sign(dx) : 0,
        y: Math.abs(dy) > 12 ? Math.sign(dy) : 0,
      };
    },
    runHeld() { return false; },
    mouse() { return { x: 640, y: 360, down: false }; },
  };
}

function giveCar(world, kind, x, y, angle) {
  const car = createCar(kind, x, y, angle || 0);
  car.driver = 'player';
  world.cars.push(car);
  world.player.car = car;
  world.player.x = x; world.player.y = y;
  world.camera.x = x; world.camera.y = y;
  return car;
}

function runSteps(world, stepWorld, input, seconds) {
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) stepWorld(world, input, 0, STEP);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `stepWorld` is the game's own fixed-step function, passed in to avoid a cycle.
 */
export function stageShot(name, world, stepWorld) {
  const p = world.player;
  if (name === 'foot') {
    // On foot on the Playa Dorada promenade, mission 1 pointing at the marina.
    p.x = 340; p.y = 2100;
    world.camera.x = p.x; world.camera.y = p.y;
    const input = makeDriver(world, () => PLACES.marina);
    runSteps(world, stepWorld, input, 3);
    return { screen: SCREEN_PLAY, state: { hasSave: false, best: '' } };
  }
  if (name === 'drive') {
    // Flat out north up the beachfront road in the Veloce, the sea on the left,
    // traffic alongside.
    giveCar(world, 'sport', 340, 2600, -Math.PI / 2);
    const input = makeDriver(world, () => ({ x: 340, y: 500 }));
    runSteps(world, stepWorld, input, 3.2);
    return { screen: SCREEN_PLAY, state: { hasSave: false, best: '' } };
  }
  if (name === 'mission') {
    // Mission 3: ramming Rico's van by the docks — start right on it, so the
    // chase is in the frame instead of already gone.
    world.missions.index = 2;
    giveCar(world, 'sedan', 1940, 3000, Math.PI / 2);
    const input = makeDriver(world, () => {
      const van = world.missions.chaseCar;
      return van ? { x: van.x, y: van.y } : PLACES.port;
    });
    runSteps(world, stepWorld, input, 3.5);
    // Frame the shot between the player and the van, so the chase itself is
    // in the picture — a photo-mode framing of the real game state.
    const van = world.missions.chaseCar;
    if (van) {
      world.camera.x = (p.x + van.x) / 2;
      world.camera.y = (p.y + van.y) / 2;
    }
    return { screen: SCREEN_PLAY, state: { hasSave: false, best: '' } };
  }
  // Default: the cover. Mission 4, three stars, CVPD on your tail, racing for the safehouse.
  world.missions.index = 3;
  giveCar(world, 'sport', 1540, 1540, Math.PI / 4);
  const input = makeDriver(world, () => PLACES.safehouse);
  runSteps(world, stepWorld, input, 4.2);
  return { screen: SCREEN_PLAY, state: { hasSave: false, best: '' } };
}
