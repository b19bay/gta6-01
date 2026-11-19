// The HUD: health, money, wanted stars, the mission objective, speed, the minimap
// and the prompts. Everything is drawn on the game canvas, so a screenshot shows
// exactly what a player sees — big, high-contrast, readable when shrunk.
import { WORLD } from './config.js';
import { currentObjective, missionTitle } from './missions.js';
import { carSpeedKmh } from './vehicles.js';
import { PLACES } from './city.js';

const MAP_SIZE = 178;
const MAP_SCALE = MAP_SIZE / WORLD.w;

export function drawMinimap(ctx, world, x, y) {
  ctx.save();
  ctx.translate(x, y);
  // Sea, sand, land.
  ctx.fillStyle = '#1e7f9e'; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#ecd9a0'; ctx.fillRect(0, 0, 14, MAP_SIZE);
  ctx.fillStyle = '#8fae6a'; ctx.fillRect(14, 0, MAP_SIZE - 14, MAP_SIZE);
  // Roads.
  ctx.fillStyle = '#3d3a38';
  for (const rx of [340, 740, 1140, 1540, 1940, 2340, 2740, 3140]) {
    ctx.fillRect(rx * MAP_SCALE, 0, 3, MAP_SIZE);
  }
  for (const ry of [340, 740, 1140, 1540, 1940, 2340, 2740, 3140]) {
    ctx.fillRect(0, ry * MAP_SCALE, MAP_SIZE, 3);
  }
  // Port strip.
  ctx.fillStyle = '#6b6f75'; ctx.fillRect(0, 3000 * MAP_SCALE, MAP_SIZE, MAP_SIZE - 3000 * MAP_SCALE);
  // Objective blip: a pulsing yellow diamond.
  const obj = currentObjective(world.missions);
  if (obj) {
    const pulse = 4 + Math.sin(world.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(obj.step.x * MAP_SCALE, obj.step.y * MAP_SCALE - pulse - 3);
    ctx.lineTo(obj.step.x * MAP_SCALE + pulse + 3, obj.step.y * MAP_SCALE);
    ctx.lineTo(obj.step.x * MAP_SCALE, obj.step.y * MAP_SCALE + pulse + 3);
    ctx.lineTo(obj.step.x * MAP_SCALE - pulse - 3, obj.step.y * MAP_SCALE);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Chase target blip (Rico's van) in orange, when a chase is running.
  const chase = world.missions.chaseCar;
  if (chase && chase.health > 0) {
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath(); ctx.arc(chase.x * MAP_SCALE, chase.y * MAP_SCALE, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#ff3b30';
  for (const cop of world.police.cars) {
    ctx.beginPath(); ctx.arc(cop.x * MAP_SCALE, cop.y * MAP_SCALE, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow, always on top.
  const p = world.player;
  ctx.save();
  ctx.translate(p.x * MAP_SCALE, p.y * MAP_SCALE);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // Frame + label.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 62, 16);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('COSTA VELA', 5, 12);
  ctx.restore();
}

function drawStars(ctx, wanted, x, y) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i += 1) {
    const filled = i < wanted;
    ctx.fillStyle = filled ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    const s = 13;
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const px = Math.cos(a) * s; const py = Math.sin(a) * s;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.translate(30, 0);
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, fill, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText(label, x + 6, y + h - 4);
}

export function drawHUD(ctx, world, view) {
  const p = world.player;
  const W = view.w; const H = view.h;
  ctx.save();
  // Top-left: health + money.
  bar(ctx, 16, 16, 220, 20, p.health / 100, p.health > 30 ? '#37c978' : '#e74c3c', `HP ${Math.ceil(p.health)}`);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(14, 42, 150, 26);
  ctx.fillStyle = '#7ee787'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 22, 61);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
  ctx.fillText(`AMMO ${p.ammo}`, 22, 84);
  // Top-right: wanted stars + minimap.
  drawStars(ctx, world.police.wanted, W - 168, 30);
  drawMinimap(ctx, world, W - MAP_SIZE - 16, 48);
  // Top-centre: mission title + objective.
  const obj = currentObjective(world.missions);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const title = missionTitle(world.missions);
  ctx.fillRect(W / 2 - 260, 12, 520, obj ? 52 : 30);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(title.toUpperCase(), W / 2, 30);
  if (obj) {
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(obj.step.text, W / 2, 50);
  }
  ctx.textAlign = 'left';
  // Bottom-left: speed when driving, controls hint otherwise.
  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(14, H - 64, 170, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${carSpeedKmh(p.car)}`, 22, H - 34);
    ctx.font = '12px sans-serif';
    ctx.fillText('km/h — ' + p.car.def.name, 78, H - 34);
    ctx.fillText('E exit car · Shift brake', 22, H - 20);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(14, H - 44, 330, 30);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText('WASD move · Shift run · E enter car · F punch · Click shoot · Q interact', 22, H - 25);
  }
  // Interaction prompt.
  if (world.prompt) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const w = ctx.measureText(world.prompt).width + 36;
    ctx.fillRect(W / 2 - w / 2, H - 118, w, 30);
    ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(world.prompt, W / 2, H - 98);
    ctx.textAlign = 'left';
  }
  // Mission banner.
  if (world.missions.bannerT > 0 && world.missions.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const w = ctx.measureText(world.missions.banner).width + 48;
    ctx.fillRect(W / 2 - w / 2, H / 2 - 110, w, 40);
    ctx.fillStyle = '#7ee787'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(world.missions.banner, W / 2, H / 2 - 84);
    ctx.textAlign = 'left';
  }
  // Wanted flash: the screen edges burn red while the heat is on.
  if (world.police.wanted > 0) {
    const a = 0.10 + Math.sin(world.time * 6) * 0.05;
    ctx.strokeStyle = `rgba(255,40,30,${a.toFixed(3)})`;
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, W, H);
  }
  ctx.restore();
}
