// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// and the renderer painting what is there. Screens: title, mission brief, play,
// paused, game over. ?shot=name&seed=N stages a screenshot scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { STEP, SAVE_KEY, CARS, SAFEHOUSE_PRICE, WORLD, ZOOM } from './config.js';
import { createRandom } from './random.js';
import { createCity, PLACES, ROADS_X, ROADS_Y, resolveCollision } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, stepPlayer, hurtPlayer } from './player.js';
import { createCar, driveCar, separateCars } from './vehicles.js';
import { createTraffic, stepTraffic, createPedestrians, stepPedestrians } from './traffic.js';
import { createPolice, stepPolice, addWanted } from './police.js';
import { createMissions, stepMissions, currentObjective, MISSIONS } from './missions.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BRIEF } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

export function createWorld(seedValue) {
  const rng = createRandom(seedValue);
  const city = createCity(rng);
  const world = {
    rng, city,
    time: 0,
    camera: { x: PLACES.marina.x, y: PLACES.marina.y },
    view: { w: 1280, h: 720 },
    zoom: ZOOM,
    player: createPlayer(PLACES.marina.x + 40, PLACES.marina.y + 40),
    cars: [],
    trafficCars: [],
    peds: createPedestrians(rng, 46),
    police: createPolice(),
    policeFoot: [],
    missions: createMissions(),
    particles: [],
    shots: [],
    gunfire: 0,
    audio: createAudio(),
    prompt: null,
    promptAction: null,
    owned: { sport: false, classic: false, safehouse: false },
    chaseFlee: null,
  };
  world.policeCars = world.police.cars;

  world.removeCar = (car) => {
    world.cars = world.cars.filter((c) => c !== car);
    world.trafficCars = world.trafficCars.filter((c) => c !== car);
  };
  world.onCrime = (type, n) => {
    addWanted(world.police, n);
    if (type === 'hitPed' || type === 'shoot') world.audio.fail();
  };
  world.setWanted = (n) => { world.police.wanted = n; world.police.heat = n > 0 ? 1 : 0; };
  world.hurtPlayer = (dmg) => hurtPlayer(world.player, dmg);
  world.spawnMissionCar = (kind, x, y, fleeing) => {
    const car = createCar(kind, x, y, rng.range(0, Math.PI * 2));
    car.driver = 'npc';
    car.npc = true;
    world.cars.push(car);
    if (fleeing) world.chaseFlee = car;
    return car;
  };
  world.burst = (x, y, color, n) => {
    for (let i = 0; i < n; i += 1) {
      world.particles.push({
        x, y,
        vx: rng.range(-120, 120), vy: rng.range(-120, 120),
        life: rng.range(0.3, 0.8), max: 0.8, size: rng.range(2, 5), color,
      });
    }
  };

  // Parked cars around the city, free for the taking.
  const parkedKinds = ['sedan', 'sedan', 'taxi', 'pickup', 'classic', 'sedan', 'van', 'taxi'];
  for (let i = 0; i < parkedKinds.length; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = horizontal ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const along = rng.range(400, WORLD.w - 400);
    const car = createCar(parkedKinds[i],
      horizontal ? along : road + 34, horizontal ? road + 34 : along,
      horizontal ? 0 : Math.PI / 2);
    car.parked = true;
    world.cars.push(car);
  }
  world.trafficCars = createTraffic(rng, 16);
  for (const c of world.trafficCars) world.cars.push(c);
  return world;
}

function resolveShot(world, angle) {
  const p = world.player;
  const range = 460;
  const x2 = p.x + Math.cos(angle) * range;
  const y2 = p.y + Math.sin(angle) * range;
  let best = null; let bd = range;
  const targets = [];
  for (const ped of world.peds) if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, r: 16, obj: ped, kind: 'ped' });
  for (const cop of world.policeFoot) if (cop.state !== 'down') targets.push({ x: cop.x, y: cop.y, r: 16, obj: cop, kind: 'cop' });
  for (const car of world.cars) targets.push({ x: car.x, y: car.y, r: 30, obj: car, kind: 'car' });
  for (const t of targets) {
    const dx = t.x - p.x; const dy = t.y - p.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < t.r && along < bd) { bd = along; best = t; }
  }
  const ex = p.x + Math.cos(angle) * bd;
  const ey = p.y + Math.sin(angle) * bd;
  world.shots.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, life: 0.12 });
  world.burst(ex, ey, '#ffd23e', 6);
  if (!best) return;
  if (best.kind === 'car') {
    best.obj.health -= 34;
    if (best.obj.health <= 0) {
      best.obj.parked = true; best.obj.speed = 0;
      world.burst(best.obj.x, best.obj.y, '#ff6b35', 22);
      world.audio.crash();
      if (best.obj.police) addWanted(world.police, 1);
    }
  } else {
    best.obj.health -= 34;
    if (best.obj.health <= 0) { best.obj.state = 'down'; best.obj.stateT = 6; }
    if (best.kind === 'cop') addWanted(world.police, 1);
  }
}

function stepFootCops(world, dt) {
  const want = world.police.wanted >= 3 ? 2 : 0;
  const rng = world.rng;
  while (world.policeFoot.length < want) {
    const a = rng.range(0, Math.PI * 2);
    world.policeFoot.push({
      x: world.player.x + Math.cos(a) * 420, y: world.player.y + Math.sin(a) * 420,
      angle: 0, health: 100, state: 'walk', stateT: 0, isCop: true, punchT: 0,
    });
  }
  while (world.policeFoot.length > want) world.policeFoot.pop();
  for (const cop of world.policeFoot) {
    if (cop.state === 'down') {
      cop.stateT -= dt;
      if (cop.stateT <= 0) { cop.state = 'walk'; cop.health = 100; }
      continue;
    }
    cop.punchT -= dt;
    const dx = world.player.x - cop.x; const dy = world.player.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (d > 30) {
      cop.x += Math.cos(cop.angle) * 200 * dt;
      cop.y += Math.sin(cop.angle) * 200 * dt;
    } else if (cop.punchT <= 0) {
      cop.punchT = 0.9;
      hurtPlayer(world.player, 6);
      world.audio.punch();
    }
  }
}

function stepShops(world, actions) {
  const p = world.player;
  world.prompt = null;
  world.promptAction = null;
  const near = (place, r) => Math.hypot(p.x - place.x, p.y - place.y) < r;
  if (!p.car && near(PLACES.dealership, 130)) {
    if (!world.owned.sport && p.money >= CARS.sport.price) {
      world.prompt = `Q — Buy the Veloce GT for $${CARS.sport.price.toLocaleString('en-US')}`;
      world.promptAction = () => {
        p.money -= CARS.sport.price;
        world.owned.sport = true;
        const car = createCar('sport', PLACES.dealership.x + 60, PLACES.dealership.y + 60, 0);
        car.parked = true;
        world.cars.push(car);
        world.audio.jingle();
      };
    } else if (!world.owned.classic && p.money >= CARS.classic.price) {
      world.prompt = `Q — Buy the Marina Classic for $${CARS.classic.price.toLocaleString('en-US')}`;
      world.promptAction = () => {
        p.money -= CARS.classic.price;
        world.owned.classic = true;
        const car = createCar('classic', PLACES.dealership.x - 60, PLACES.dealership.y + 60, 0);
        car.parked = true;
        world.cars.push(car);
        world.audio.jingle();
      };
    } else if (!world.owned.sport && !world.owned.classic) {
      world.prompt = `Veloce Motors — Veloce GT $${CARS.sport.price.toLocaleString('en-US')} · Marina Classic $${CARS.classic.price.toLocaleString('en-US')}`;
    } else {
      world.prompt = 'Veloce Motors — thanks for your business, Dario';
    }
  } else if (!p.car && near(PLACES.safehouse, 130)) {
    if (!world.owned.safehouse) {
      if (p.money >= SAFEHOUSE_PRICE) {
        world.prompt = `Q — Buy the safehouse for $${SAFEHOUSE_PRICE.toLocaleString('en-US')}`;
        world.promptAction = () => {
          p.money -= SAFEHOUSE_PRICE;
          world.owned.safehouse = true;
          world.audio.jingle();
        };
      } else {
        world.prompt = `Safehouse for sale — $${SAFEHOUSE_PRICE.toLocaleString('en-US')} (you have $${p.money.toLocaleString('en-US')})`;
      }
    } else {
      world.prompt = 'Q — Lay low: save, heal up, lose the heat';
      world.promptAction = () => {
        world.setWanted(0);
        world.player.health = 100;
        saveGame(world);
        world.audio.pickup();
      };
    }
  } else if (p.car && near(PLACES.garage, 140)) {
    world.prompt = "Q — Mara's Garage: repair the car and patch up (free)";
    world.promptAction = () => {
      p.car.health = 100;
      p.health = 100;
      world.audio.pickup();
    };
  }
  if ((actions & ACTION_INTERACT) && world.promptAction) world.promptAction();
}

function stepWorld(world, input, actions, dt) {
  world.time += dt;
  world.gunfire = Math.max(0, world.gunfire - dt);
  const ev = stepPlayer(world.player, input, world, actions, dt);
  if (ev.shot) resolveShot(world, ev.shot.angle);
  if (ev.stole) world.burst(ev.stole.x, ev.stole.y, '#ffffff', 8);
  // Cars never drive through buildings: push every car out of walls and the sea.
  for (const car of world.cars) {
    resolveCollision(world.city, car, 24);
    car.hitT = Math.max(0, (car.hitT || 0) - dt);
    if (car.speed !== 0 && Math.abs(car.speed) < 2) car.speed = 0;
  }
  stepTraffic(world.trafficCars, world.player, dt, world.rng);
  separateCars(world.cars);
  stepPedestrians(world.peds, world.city, world.player, world.gunfire > 0, dt, world.rng);
  // The fleeing chase van: away from the player, flat out.
  if (world.chaseFlee && world.chaseFlee.health > 0) {
    const van = world.chaseFlee;
    const away = Math.atan2(van.y - world.player.y, van.x - world.player.x);
    const diff = Math.atan2(Math.sin(away - van.angle), Math.cos(away - van.angle));
    driveCar(van, Math.max(-1, Math.min(1, diff * 2)), 1, dt, false);
  }
  stepPolice(world.police, world.player, world, dt, world.rng);
  stepFootCops(world, dt);
  stepMissions(world.missions, world, dt);
  stepShops(world, actions);
  // Particles and tracers fade.
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  for (const s of world.shots) s.life -= dt;
  world.shots = world.shots.filter((s) => s.life > 0);
  // Camera eases after the player.
  const cam = world.camera;
  cam.x += (world.player.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (world.player.y - cam.y) * Math.min(1, dt * 5);
  world.audio.update(dt, !!world.player.car,
    world.player.car ? Math.abs(world.player.car.speed) / world.player.car.def.top : 0,
    world.police.wanted);
}

function saveGame(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: world.player.money,
      missionIndex: world.missions.index,
      owned: world.owned,
    }));
  } catch { /* storage off: the run lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function runShot(name) {
  const world = createWorld(seed);
  const scene = stageShot(name, world, stepWorld);
  const renderer = createRenderer(canvas);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  canvas.width = 1280; canvas.height = 720;
  world.view = { w: 1280, h: 720 };
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(seed);
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = '';
  const save = loadSave();
  const state = { hasSave: !!save, best: '' };
  if (save) state.best = `Saved: $${save.money.toLocaleString('en-US')} · Mission ${Math.min(save.missionIndex + 1, 6)}/6`;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    world.view = { w: canvas.width, h: canvas.height };
  }
  window.addEventListener('resize', resize);
  resize();

  function applySave(s) {
    world.player.money = s.money;
    world.missions.index = Math.min(s.missionIndex, MISSIONS.length - 1);
    world.missions.step = 0;
    world.owned = { ...world.owned, ...s.owned };
  }

  function startGame(fresh) {
    if (!fresh && save) applySave(save);
    world.player.x = PLACES.marina.x + 40;
    world.player.y = PLACES.marina.y + 40;
    world.player.health = 100;
    world.player.dead = false;
    world.setWanted(0);
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    screen = SCREEN_BRIEF;
    world.audio.unlock();
    status.textContent = 'Costa Vela. Mission briefing.';
  }

  function announce(msg) { status.textContent = msg; }
  announce('Costa Vela. Press Enter to start.');

  let accumulator = 0;
  let last = performance.now();
  const MAX_FRAME = 0.25;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      renderer.draw(world, screen, state);
      world.time += 0.016;
      return;
    }
    if (screen === SCREEN_BRIEF) {
      if (actions & ACTION_CONFIRM) { screen = SCREEN_PLAY; announce('Playing. Follow the yellow marker.'); }
      renderer.draw(world, screen, state);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
      renderer.draw(world, screen, state);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        // Back on your feet at the marina, same mission, money kept.
        world.player.dead = false;
        world.player.health = 100;
        world.player.x = PLACES.marina.x + 40;
        world.player.y = PLACES.marina.y + 40;
        if (world.player.car) { world.player.car.driver = null; world.player.car = null; }
        world.setWanted(0);
        world.camera.x = world.player.x; world.camera.y = world.player.y;
        screen = SCREEN_PLAY;
        announce('Back on your feet. Follow the yellow marker.');
      }
      renderer.draw(world, screen, state);
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      renderer.draw(world, screen, state);
      return;
    }
    // The frame's actions apply to the first fixed step only; later steps in the
    // same frame see none, so one key press is never read twice.
    const frameInput = {
      move: () => input.move(),
      runHeld: () => input.runHeld(),
      mouse: () => input.mouse(),
    };
    let firstStep = true;
    while (accumulator >= STEP) {
      stepWorld(world, frameInput, firstStep ? actions : 0, STEP);
      firstStep = false;
      accumulator -= STEP;
      if (world.player.dead) {
        screen = SCREEN_OVER;
        world.audio.fail();
        announce('Game over.');
        break;
      }
    }
    renderer.draw(world, screen, state);
  }
  requestAnimationFrame(frame);

  // Fresh-story key: N on the title screen.
  window.addEventListener('keydown', (e) => {
    if (screen === SCREEN_TITLE && (e.code === 'KeyN')) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      startGame(true);
    }
    if (screen === SCREEN_PLAY && e.code === 'KeyM') world.audio.toggle();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
}

if (shot) runShot(shot);
else runGame();
