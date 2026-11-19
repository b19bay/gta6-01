// Costa Vela, the city itself: a road grid over a sun-soaked coast.
// West edge is sand and sea; south edge is the port; the middle is downtown,
// ringed by suburbs. Buildings, palms and parks are placed once, from the seed,
// and the same seed always builds the same city.
import { PALETTE, WORLD } from './config.js';

const ROAD_W = WORLD.road;
const BLOCK = WORLD.block;

/** Road centre lines, in world pixels. */
export const ROADS_X = [340, 740, 1140, 1540, 1940, 2340, 2740, 3140];
export const ROADS_Y = [340, 740, 1140, 1540, 1940, 2340, 2740, 3140];

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null; let bd = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, horizontal: false }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, horizontal: true }; }
  }
  return best;
}

/** Named places the story and the missions use. */
export const PLACES = {
  marina:      { x: 340,  y: 740,  label: 'Marina Vela' },
  hotel:       { x: 740,  y: 340,  label: 'Hotel Brisa' },
  dealership:  { x: 1540, y: 1140, label: 'Veloce Motors' },
  garage:      { x: 1140, y: 1940, label: "Mara's Garage" },
  safehouse:   { x: 2740, y: 2740, label: 'Safehouse — Calle Palma' },
  port:        { x: 1940, y: 3140, label: 'Porto Vela Docks' },
  warehouse:   { x: 2340, y: 2740, label: 'Warehouse 7' },
  yacht:       { x: 340,  y: 1540, label: 'Yacht Aurelia' },
  plaza:       { x: 1540, y: 1540, label: 'Plaza del Sol' },
  beach:       { x: 340,  y: 2340, label: 'Playa Dorada' },
  rivalLot:    { x: 2340, y: 740,  label: 'Downtown Lot' },
};

export function districtAt(x, y) {
  if (x < 420) return 'beach';
  if (y > 3000) return 'port';
  if (x > 1140 && x < 2340 && y > 1140 && y < 2340) return 'downtown';
  if (x > 2340 || y > 2340) return 'suburbs';
  return 'oldtown';
}

export function createCity(rng) {
  const buildings = [];
  const palms = [];
  const parks = [];
  // One building per block cell, skipped on the beach strip and the port strip.
  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const cx = ROADS_X[bx] + ROAD_W / 2 + (BLOCK - ROAD_W) / 2;
      const cy = ROADS_Y[by] + ROAD_W / 2 + (BLOCK - ROAD_W) / 2;
      const d = districtAt(cx, cy);
      if (d === 'beach' || d === 'port') continue;
      if (d === 'downtown' && rng.chance(0.12)) { parks.push({ x: cx, y: cy, r: 120 }); continue; }
      const tall = d === 'downtown';
      const w = rng.range(120, 220);
      const h = rng.range(120, 220);
      buildings.push({
        x: cx + rng.range(-30, 30), y: cy + rng.range(-30, 30),
        w, h,
        color: rng.pick(PALETTE.building),
        roof: rng.pick(PALETTE.roof),
        floors: tall ? rng.int(6, 14) : rng.int(1, 3),
        tall,
      });
    }
  }
  // Palm rows along the beachfront promenade and the plaza.
  for (let y = 300; y < 3300; y += 130) palms.push({ x: 300 + rng.range(-8, 8), y });
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: PLACES.plaza.x + rng.range(-140, 140), y: PLACES.plaza.y + rng.range(-140, 140) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: rng.range(500, 3200), y: rng.range(500, 3200) });
  }
  return { buildings, palms, parks };
}

/** True when the point is inside a building or in the sea (not walkable / not drivable). */
export function blockedAt(city, x, y) {
  if (x < 170 || x > WORLD.w - 20 || y < 20 || y > WORLD.h - 20) return true; // sea + map edge
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(y - b.y) < b.h / 2 + 4) return true;
  }
  return false;
}

/** Push a circle out of buildings and the sea; used after every move. */
export function resolveCollision(city, e, radius) {
  for (const b of city.buildings) {
    const dx = e.x - b.x; const dy = e.y - b.y;
    const ox = b.w / 2 + radius - Math.abs(dx);
    const oy = b.h / 2 + radius - Math.abs(dy);
    if (ox > 0 && oy > 0) {
      if (ox < oy) e.x += dx > 0 ? ox : -ox;
      else e.y += dy > 0 ? oy : -oy;
    }
  }
  if (e.x < 170 + radius) e.x = 170 + radius;
  if (e.x > WORLD.w - 20 - radius) e.x = WORLD.w - 20 - radius;
  if (e.y < 20 + radius) e.y = 20 + radius;
  if (e.y > WORLD.h - 20 - radius) e.y = WORLD.h - 20 - radius;
}
