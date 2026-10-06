// src/battle/sim/buildings.js
// The region's own buildings on the battlefield. Everything the province has built (besides its
// fortifications, which are the keep and towers) stands near the keep as a real structure. While
// it stands it helps the defender; the attacker can raze it for plunder, and a razed building
// loses a tier back in the campaign (src/engine/invasion.js's applyRazedBuildings).
//   military  (Barracks…)  reserves and reinforcements cost 30% less supply and arrive faster
//   economy   (Market…)    +1 Battle Supply per second
//   logistics (Road Post…) +1 Battle Supply per second
//   naval     (Harbor…)    +1 Battle Supply per second
//   industry  (Workshop…)  field repairs: the keep and towers regain HP
//   culture   (Temple…)    defenders nearby recover morale faster
//   food      (Granary…)   defenders resting nearby heal
//   science   (Library…)   commander powers recharge 25% faster
import { distSq } from './fixed';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { lootCityBuilding } from './economy';

export const BUILDING_EFFECTS = {
  military: 'Cheaper, faster reserves',
  economy: '+1 supply/s',
  logistics: '+1 supply/s',
  naval: '+1 supply/s',
  industry: 'Repairs the keep and towers',
  culture: 'Faster morale recovery nearby',
  food: 'Resting troops nearby heal',
  science: 'Powers recharge faster'
};
export const RAZE_PLUNDER = 60;
const AURA = 8 * Q;
const REPAIR_PER_SEC = 4;
const MORALE_PER_SEC = 2;
const HEAL_PER_SEC = 0.004;
const REST_TICKS = 200;

const standing = (w, category) => w.structures.some((s) => s.kind === 'building' && s.category === category && s.alive);
const standingOf = (w, category) => w.structures.filter((s) => s.kind === 'building' && s.category === category && s.alive);

// Battle Supply the defender's buildings add each second.
export const buildingSupplyPerSec = (w, side) => (side !== SIDE_DEFENDER ? 0
  : ['economy', 'logistics', 'naval'].filter((c) => standing(w, c)).length);

export const reserveCostMult = (w, side) => (w && side === SIDE_DEFENDER && standing(w, 'military') ? 0.7 : 1);
export const reserveEntryMult = (w, side) => (w && side === SIDE_DEFENDER && standing(w, 'military') ? 0.6 : 1);
export const powerCooldownMult = (w, side) => (side === SIDE_DEFENDER && standing(w, 'science') ? 0.75 : 1);

// Once a second: repairs, morale and healing around the defender's buildings.
export const updateBuildings = (w) => {
  if (w.tick % 20 !== 0 || w.tick === 0) return;
  if (standing(w, 'industry')) {
    w.structures.forEach((s) => { if (s.alive && s.kind !== 'building' && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + REPAIR_PER_SEC); });
  }
  const temples = standingOf(w, 'culture'); const granaries = standingOf(w, 'food');
  if (!temples.length && !granaries.length) return;
  w.squads.forEach((q) => {
    if (q.side !== SIDE_DEFENDER || !q.alive || !q.onField || q.fled) return;
    const near = (list) => list.some((b) => distSq(b.x, b.y, q.x, q.y) <= AURA * AURA);
    if (near(temples) && !q.routed) q.morale = Math.min(100, q.morale + MORALE_PER_SEC);
    if (near(granaries) && w.tick - q.lastHitTick > REST_TICKS && q.strength < q.startStrength) {
      q.strength = Math.min(q.startStrength, q.strength + Math.max(1, Math.round(q.maxStrength * HEAL_PER_SEC)));
    }
  });
};

// Called when a building's HP hits zero: the attacker plunders it.
export const razeBuilding = (w, s, bySide) => {
  if (bySide === SIDE_ATTACKER) w.supply[SIDE_ATTACKER] = Math.min(w.setup.supplyCap, w.supply[SIDE_ATTACKER] + RAZE_PLUNDER);
  lootCityBuilding(w, bySide); // with a battle economy, its gold too (economy.js)
  w.razed = [...(w.razed || []), s.category];
  w.events.push({ t: w.tick, type: 'buildingRazed', structure: s.id, category: s.category });
};
