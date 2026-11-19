// Costa Vela — one city, one sun, one long afternoon.
// Every tunable number for the game lives here, so a balance pass touches one file.
export const CITY_NAME = 'Costa Vela';
export const GAME_TITLE = 'COSTA VELA';
export const SAVE_KEY = 'costavela-save-v1';

/** World size in pixels. The city is a grid; the sea is west, the port south. */
export const WORLD = { w: 3400, h: 3400, block: 400, road: 96 };

/** Fixed step, seconds per simulation tick. */
export const STEP = 1 / 60;

/** Camera zoom: the world is drawn larger than 1:1 so cars and streets read at a glance. */
export const ZOOM = 1.3;

/** Player on foot. */
export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 320,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.35,
  pistolDamage: 34,
  pistolRange: 460,
  pistolCooldown: 0.28,
  pistolStartAmmo: 24,
};

/** Car definitions: the fleet a player can steal, buy or be chased by. */
export const CARS = {
  sedan:   { name: 'Vela Sedan',   color: '#4a7fb5', top: 430, accel: 300, grip: 2.6, len: 52, wid: 26, price: 0 },
  taxi:    { name: 'Costa Taxi',   color: '#f2c230', top: 400, accel: 280, grip: 2.6, len: 52, wid: 26, price: 0 },
  pickup:  { name: 'Port Pickup',  color: '#7a5c3e', top: 400, accel: 270, grip: 2.4, len: 56, wid: 28, price: 0 },
  van:     { name: 'Harbor Van',   color: '#8a8f96', top: 360, accel: 230, grip: 2.2, len: 60, wid: 28, price: 0 },
  sport:   { name: 'Veloce GT',    color: '#d23b2e', top: 620, accel: 460, grip: 3.4, len: 54, wid: 26, price: 1800 },
  police:  { name: 'CVPD Interceptor', color: '#1c2733', top: 660, accel: 480, grip: 3.2, len: 54, wid: 26, price: 0 },
  classic: { name: 'Marina Classic', color: '#2e8b6a', top: 470, accel: 320, grip: 2.8, len: 54, wid: 26, price: 900 },
};

/** Wanted level rules: crimes, escalation, decay. */
export const WANTED = {
  max: 5,
  decayDelay: 9,      // seconds with no police near before stars start falling
  decayStep: 4,       // seconds per star lost while hidden
  copsPerStar: [0, 1, 2, 3, 4, 5],
  roadblockFrom: 3,
};

/** Mission payouts, in dollars. */
export const MISSION_PAY = [400, 700, 900, 1200, 1600, 2500];
export const SAFEHOUSE_PRICE = 3000;

/** Sun-soaked palette: warm sand, turquoise sea, white stucco, terracotta roofs. */
export const PALETTE = {
  grass: '#7fae62',
  sand: '#ecd9a0',
  sea: '#2fa8b8',
  seaDeep: '#1e7f9e',
  road: '#3d3a38',
  roadEdge: '#f5d76e',
  sidewalk: '#cfc4ae',
  plaza: '#d8c9a3',
  building: ['#e8dcc8', '#d9b48f', '#c98f6b', '#a8c6d8', '#e8b4a0', '#f0e0b8'],
  roof: ['#b4552d', '#8f3b2a', '#c97b4a', '#5a7d8a'],
  palm: '#3f7d44',
  park: '#6fae5e',
};
