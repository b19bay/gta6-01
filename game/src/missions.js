// The story: Dario Cruz, a courier who owes the wrong people in Costa Vela,
// works off his debt one job at a time for Mara Solis — six missions, each a chain
// of objectives with a marker on the map and on the HUD. Finishing one pays out;
// finishing all six closes the story and leaves the city open to roam.
import { PLACES } from './city.js';
import { MISSION_PAY } from './config.js';

export const STORY = {
  hero: 'Dario Cruz',
  fixer: 'Mara Solis',
  intro: 'Dario owes the Vela crew $12,000. Mara gives him jobs. Six jobs, and he is free.',
};

function step(type, place, text, extra) {
  return { type, x: PLACES[place].x, y: PLACES[place].y, label: PLACES[place].label, text, ...(extra || {}) };
}

export const MISSIONS = [
  {
    id: 1, title: 'First Drop',
    brief: 'Mara: "Pick up the package at the marina. Deliver it to Hotel Brisa. No questions, no cops."',
    steps: [
      step('goto', 'marina', 'Pick up the package at Marina Vela'),
      step('deliver', 'hotel', 'Deliver the package to Hotel Brisa'),
    ],
  },
  {
    id: 2, title: 'Hot Wheels',
    brief: 'Mara: "A Veloce GT is sitting in the downtown lot. Take it. Bring it to my garage."',
    steps: [
      step('steal', 'rivalLot', 'Steal the red Veloce GT from the downtown lot (E near the car)'),
      step('drive', 'garage', "Drive the Veloce to Mara's Garage"),
    ],
  },
  {
    id: 3, title: 'Payback',
    brief: 'Mara: "Rico\'s van took my last shipment. Ram it off the road, then come home."',
    steps: [
      step('chase', 'port', 'Find Rico\'s van near the docks and ram it until it stops'),
      step('goto', 'garage', "Report back to Mara's Garage"),
    ],
  },
  {
    id: 4, title: 'Heat Wave',
    brief: 'Mara: "The CVPD is on you. Three stars and climbing. Lose them at the safehouse."',
    steps: [
      step('escape', 'safehouse', 'Reach the safehouse on Calle Palma — the heat must be on you'),
    ],
  },
  {
    id: 5, title: 'Harbor Run',
    brief: 'Mara: "Crates at the docks, Warehouse 7 after dark. The port police will not wave you through."',
    steps: [
      step('goto', 'port', 'Collect the crates at Porto Vela Docks'),
      step('deliver', 'warehouse', 'Deliver the crates to Warehouse 7 — wanted level will rise'),
    ],
  },
  {
    id: 6, title: 'The Big Score',
    brief: 'Mara: "The Aurelia sails at dawn with the crew\'s gold. Take it to the Plaza. Then we are done."',
    steps: [
      step('goto', 'yacht', 'Board the Yacht Aurelia and take the gold'),
      step('deliver', 'plaza', 'Bring the gold to Plaza del Sol — the whole city will be watching'),
    ],
  },
];

export function createMissions() {
  return { index: 0, step: 0, done: false, banner: null, bannerT: 0, chaseCar: null };
}

/** The current objective, for the HUD, the minimap and the world marker. */
export function currentObjective(missions) {
  if (missions.done) return null;
  const m = MISSIONS[missions.index];
  if (!m) return null;
  const s = m.steps[missions.step];
  return { mission: m, step: s, missionIndex: missions.index, stepIndex: missions.step };
}

/**
 * Advance the mission chain. Returns events: { stepDone, missionDone, allDone, payout }.
 * `world` supplies the player, the police and the hooks a step needs (spawn chase car,
 * raise the heat, clear it at the safehouse).
 */
export function stepMissions(missions, world, dt) {
  const ev = { stepDone: false, missionDone: false, allDone: false, payout: 0 };
  if (missions.bannerT > 0) missions.bannerT -= dt;
  if (missions.done) return ev;
  const obj = currentObjective(missions);
  if (!obj) return ev;
  const { mission, step: s } = obj;
  const p = world.player;
  const d = Math.hypot(p.x - s.x, p.y - s.y);

  // Step setup, once, the first tick the step is active.
  if (!s._setup) {
    s._setup = true;
    if (mission.id === 2 && s.type === 'steal') world.spawnMissionCar('sport', s.x, s.y);
    if (mission.id === 3 && s.type === 'chase') {
      missions.chaseCar = world.spawnMissionCar('van', s.x, s.y, true);
    }
    if (mission.id === 4 && s.type === 'escape') world.setWanted(3);
    if (mission.id === 5 && s.type === 'deliver') world.setWanted(2);
    if (mission.id === 6 && s.type === 'deliver') world.setWanted(4);
  }

  let complete = false;
  if (s.type === 'goto' || s.type === 'deliver' || s.type === 'drive') {
    complete = d < (s.type === 'drive' ? 130 : 90);
  } else if (s.type === 'steal') {
    complete = !!(p.car && p.car.kind === 'sport');
  } else if (s.type === 'chase') {
    complete = !missions.chaseCar || missions.chaseCar.health <= 0 || missions.chaseCar.parked;
  } else if (s.type === 'escape') {
    complete = d < 110;
  }

  if (!complete) return ev;
  ev.stepDone = true;
  missions.step += 1;
  if (missions.step >= mission.steps.length) {
    const payout = MISSION_PAY[missions.index] || 500;
    ev.payout = payout;
    ev.missionDone = true;
    world.player.money += payout;
    world.audio.jingle();
    missions.banner = `MISSION COMPLETE — ${mission.title}  +$${payout}`;
    missions.bannerT = 4;
    if (mission.id === 4) world.setWanted(0); // the safehouse clears the heat
    if (mission.id === 6) {
      missions.done = true;
      ev.allDone = true;
      missions.banner = 'THE BIG SCORE — Dario is free. Costa Vela is yours.  +$2,500';
      missions.bannerT = 6;
    }
    missions.index += 1;
    missions.step = 0;
  } else {
    world.audio.pickup();
  }
  return ev;
}

export function missionTitle(missions) {
  if (missions.done) return 'Free Roam — Costa Vela is yours';
  const m = MISSIONS[missions.index];
  return m ? `Mission ${m.id}/6 — ${m.title}` : '';
}
