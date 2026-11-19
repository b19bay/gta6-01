// The painter: the city, its people and cars, the sun on top of it all,
// then the screens (title, pause, game over, mission brief).
// Everything is flat vector shapes on one canvas — no images, no network.
import { PALETTE, WORLD, CITY_NAME, GAME_TITLE, ZOOM } from './config.js';
import { ROADS_X, ROADS_Y, PLACES, districtAt } from './city.js';
import { currentObjective, MISSIONS, STORY } from './missions.js';
import { drawHUD } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BRIEF = 'brief';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const { len, wid } = car.def;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8); ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -len / 2, -wid / 2, len, wid, 8); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  rr(ctx, -len / 2 + 12, -wid / 2 + 4, 14, wid - 8, 4); ctx.fill(); // windshield
  rr(ctx, len / 2 - 20, -wid / 2 + 4, 12, wid - 8, 4); ctx.fill(); // rear window
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 5);
  if (car.health <= 0) {
    // A wreck: scorched and still.
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    rr(ctx, -len / 2, -wid / 2, len, wid, 8); ctx.fill();
  }
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -wid / 2, 16, wid);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CVPD', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, down, isCop) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    rr(ctx, -13, -6, 26, 12, 6); ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow, body, head, direction tick.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.arc(4, 0, 6.5, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
}

function drawBuilding(ctx, b, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, b.x - b.w / 2 + 5, b.y - b.h / 2 + 6, b.w, b.h, 6); ctx.fill();
  ctx.fillStyle = b.color;
  rr(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 6); ctx.fill();
  ctx.fillStyle = b.roof;
  rr(ctx, b.x - b.w / 2 + 6, b.y - b.h / 2 + 6, b.w - 12, b.h - 12, 4); ctx.fill();
  // Windows: a grid that reads at a glance, sunlit on one side.
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const wx = b.x - b.w / 2 + 16 + (i * (b.w - 32)) / Math.max(1, cols - 1);
      const wy = b.y - b.h / 2 + 16 + (j * (b.h - 32)) / Math.max(1, rows - 1);
      ctx.fillStyle = (i + j) % 3 === 0 ? 'rgba(255,240,180,0.9)' : 'rgba(40,60,90,0.85)';
      ctx.fillRect(wx - 5, wy - 6, 10, 12);
    }
  }
  if (b.tall) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${b.floors}F`, b.x, b.y + 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawWorld(ctx, world, view) {
  const cam = world.camera;
  const x0 = cam.x - view.w / 2; const y0 = cam.y - view.h / 2;
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  // Sky-warm ground: grass, then sand + sea on the west edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-x0, -y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, 0, 300, WORLD.h);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(0, 0, 170, WORLD.h);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let y = 0; y < WORLD.h; y += 120) {
    ctx.fillRect(20 + ((y / 120) % 2) * 40, y, 90, 8);
  }
  // Port concrete on the south strip.
  ctx.fillStyle = '#6b6f75';
  ctx.fillRect(0, 3000, WORLD.w, WORLD.h - 3000);
  ctx.fillStyle = '#54585e';
  for (let x = 200; x < WORLD.w; x += 260) ctx.fillRect(x, 3120, 180, 60);
  // Parks.
  for (const park of world.city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.beginPath(); ctx.arc(park.x, park.y, park.r, 0, Math.PI * 2); ctx.fill();
  }
  // Sidewalks, then roads with centre dashes.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) ctx.fillRect(rx - 62, 0, 124, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - 62, WORLD.w, 124);
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - 48, 0, 96, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - 48, WORLD.w, 96);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD.h; y += 90) ctx.fillRect(rx - 2, y, 4, 44);
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD.w; x += 90) ctx.fillRect(x, ry - 2, 44, 4);
  }
  // Buildings, palms, place labels.
  for (const b of world.city.buildings) drawBuilding(ctx, b, world.time);
  ctx.fillStyle = PALETTE.palm;
  for (const palm of world.city.palms) {
    ctx.beginPath(); ctx.arc(palm.x, palm.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2c5a30'; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + Math.cos(a) * 16, palm.y + Math.sin(a) * 16); ctx.stroke();
    }
  }
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const w = ctx.measureText(pl.label).width + 14;
    ctx.fillRect(pl.x - w / 2, pl.y - 52, w, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(pl.label, pl.x, pl.y - 39);
  }
  ctx.textAlign = 'left';
  // Objective marker: a tall pulsing diamond + a ring on the ground.
  const obj = currentObjective(world.missions);
  if (obj) {
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    ctx.save();
    ctx.translate(obj.step.x, obj.step.y);
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 44 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(0, -58); ctx.lineTo(12, -34); ctx.lineTo(-12, -34);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // The chase target wears a marker, so a chase reads as a chase.
  const chaseCar = world.missions.chaseCar;
  if (chaseCar && chaseCar.health > 0) {
    ctx.save();
    ctx.translate(chaseCar.x, chaseCar.y);
    ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 40 + Math.sin(world.time * 5) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const lw = ctx.measureText("RICO'S VAN").width + 10;
    ctx.fillRect(-lw / 2, -58, lw, 16);
    ctx.fillStyle = '#ff8c1a';
    ctx.fillText("RICO'S VAN", 0, -46);
    ctx.restore();
  }
  // Cars, people, particles, bullets.
  for (const car of world.cars) drawCarShape(ctx, car);
  for (const p of world.peds) drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.state === 'down', false);
  for (const cop of world.policeFoot) drawPerson(ctx, cop.x, cop.y, cop.angle, '#1c2733', cop.state === 'down', true);
  const pl = world.player;
  if (!pl.car) drawPerson(ctx, pl.x, pl.y, pl.angle, '#d23b2e', pl.dead, false);
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const s of world.shots) {
    ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.restore();
  // Warm afternoon sun: a soft radial glow that never hides the HUD.
  const g = ctx.createRadialGradient(view.w * 0.82, view.h * 0.12, 40, view.w * 0.82, view.h * 0.12, view.w * 0.75);
  g.addColorStop(0, 'rgba(255,236,170,0.20)');
  g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.restore();
}

function screenPanel(ctx, view, title, lines, foot) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  const w = Math.min(680, view.w - 60);
  const h = 120 + lines.length * 30 + (foot ? 46 : 0);
  const x = (view.w - w) / 2; const y = (view.h - h) / 2;
  ctx.fillStyle = 'rgba(8,14,22,0.92)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, view.w / 2, y + 52);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, view.w / 2, y + 96 + i * 30));
  if (foot) {
    ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(foot, view.w / 2, y + h - 22);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function draw(world, screen, state) {
    const view = { w: canvas.width, h: canvas.height };
    const worldView = { w: view.w / ZOOM, h: view.h / ZOOM };
    ctx.clearRect(0, 0, view.w, view.h);
    if (screen === SCREEN_TITLE) {
      drawWorld(ctx, world, worldView);
      ctx.fillStyle = 'rgba(10,18,28,0.55)';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 84px sans-serif';
      ctx.fillText(GAME_TITLE, view.w / 2, view.h / 2 - 96);
      ctx.fillStyle = '#fff';
      ctx.font = '22px sans-serif';
      ctx.fillText('A sun-soaked open-world crime story', view.w / 2, view.h / 2 - 58);
      ctx.font = '16px sans-serif';
      ctx.fillText(`${STORY.hero} owes the Vela crew $12,000. ${STORY.fixer} gives him six jobs. Six jobs, and he is free.`, view.w / 2, view.h / 2 - 22);
      ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(state.hasSave ? 'ENTER — Continue your story      N — New game' : 'ENTER — Start the story', view.w / 2, view.h / 2 + 30);
      ctx.fillStyle = '#ddd'; ctx.font = '14px sans-serif';
      ctx.fillText('WASD move / drive · Shift run / brake · E enter or steal a car · F punch · Click shoot · Q interact · P pause', view.w / 2, view.h / 2 + 66);
      ctx.fillText('Steal cars, run missions, lose the cops. Save with Q at the safehouse.', view.w / 2, view.h / 2 + 90);
      if (state.best) {
        ctx.fillStyle = '#7ee787'; ctx.font = '15px sans-serif';
        ctx.fillText(`Best so far: ${state.best}`, view.w / 2, view.h / 2 + 122);
      }
      ctx.textAlign = 'left';
      return;
    }
    drawWorld(ctx, world, worldView);
    drawHUD(ctx, world, view);
    if (screen === SCREEN_BRIEF) {
      const m = MISSIONS[world.missions.index];
      if (m) {
        screenPanel(ctx, view, `MISSION ${m.id} — ${m.title.toUpperCase()}`,
          [m.brief, '', 'Press ENTER to start the job.'], 'MARA SOLIS · MARINA VELA');
      }
    } else if (screen === SCREEN_PAUSED) {
      screenPanel(ctx, view, 'PAUSED',
        ['The city waits. The sun does not.', '', 'ENTER resume · M mute · R restart story'], 'COSTA VELA');
    } else if (screen === SCREEN_OVER) {
      screenPanel(ctx, view, 'BUSTED — FLATLINED',
        ['Dario went down in Costa Vela.', `You kept $${world.player.money.toLocaleString('en-US')} and finished ${world.missions.index} of 6 missions.`, '', 'ENTER — Try again from the last save'], 'THE CREW REMEMBERS');
    }
  }
  return { draw };
}
