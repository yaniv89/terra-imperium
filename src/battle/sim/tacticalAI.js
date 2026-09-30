// src/battle/sim/tacticalAI.js
// The enemy commander (Tactical Battles plan §9). It runs INSIDE the deterministic sim and speaks
// only through orders (src/battle/sim/orders.js), exactly like the player — so it replays
// identically and can never do anything a player couldn't. Difficulty changes how often it thinks
// and how sharply it plays, never what it's allowed to do.
import { distSq } from './fixed';
import { fieldCap, fieldCount } from './world';
import { RESERVE_COST } from './orders';
import { isFighting } from './combat';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';

export const AI_DIFFICULTY = {
  settler: { thinkEvery: 24, retreatAt: 0.15, useReserves: 0.5 },
  chieftain: { thinkEvery: 20, retreatAt: 0.2, useReserves: 0.7 },
  prince: { thinkEvery: 10, retreatAt: 0.25, useReserves: 1 },
  king: { thinkEvery: 6, retreatAt: 0.3, useReserves: 1 },
  emperor: { thinkEvery: 4, retreatAt: 0.3, useReserves: 1 }
};
const DEFENSE_RADIUS = 24 * Q;

const own = (w, side) => w.squads.filter((q) => q.side === side && isFighting(q) && !q.routed && !q.retreating);
const nearestEnemy = (w, side, x, y, maxD = Infinity) => {
  let best = null; let bestD = maxD * maxD;
  w.squads.forEach((q) => {
    if (q.side === side || !isFighting(q) || q.routed) return;
    const d = distSq(q.x, q.y, x, y);
    if (d < bestD) { bestD = d; best = q; }
  });
  return best;
};

const callReserves = (w, side, cfg, orders) => {
  if (cfg.useReserves < 1 && (w.tick / 200) % 1 > cfg.useReserves) return;
  const waiting = w.squads.filter((q) => q.side === side && q.reserve && q.alive && q.enterTick < 0);
  let slots = fieldCap(w) - fieldCount(w, side);
  let supply = w.supply[side];
  waiting.forEach((q) => {
    if (slots <= 0 || supply < RESERVE_COST) return;
    orders.push({ side, type: 'callReserve', squads: [q.idx] });
    slots -= 1; supply -= RESERVE_COST;
  });
};

const thinkAttacker = (w, side, orders) => {
  const keep = w.structures[0];
  own(w, side).forEach((q) => {
    if (q.order.type !== 'idle' || q.target >= 0) return;
    if (q.stats.structureBonus) {
      const tower = w.structures.find((s) => s.alive && s.kind === 'tower');
      const s = tower || (keep.alive ? keep : null);
      if (s) { orders.push({ side, type: 'attack', squads: [q.idx], target: { kind: 'structure', index: w.structures.indexOf(s) } }); return; }
    }
    orders.push({ side, type: 'attackMove', squads: [q.idx], x: keep.x - 2 * Q, y: keep.y });
  });
};

const thinkDefender = (w, side, orders) => {
  const keep = w.structures[0];
  const threat = nearestEnemy(w, side, keep.x, keep.y, DEFENSE_RADIUS);
  own(w, side).forEach((q) => {
    if (q.target >= 0 || q.order.type === 'attackMove') return;
    if (threat) orders.push({ side, type: 'attackMove', squads: [q.idx], x: threat.x, y: threat.y });
  });
};

export const thinkAI = (w, side, orders) => {
  const cfg = AI_DIFFICULTY[w.setup.difficultyId] || AI_DIFFICULTY.prince;
  if (w.tick % cfg.thinkEvery !== side) return; // sides think on different ticks
  callReserves(w, side, cfg, orders);
  const mine = own(w, side);
  const start = w.setup.sides[side].units.reduce((s, u) => s + u.strength, 0) || 1;
  const now = w.squads.filter((q) => q.side === side && q.alive && !q.fled).reduce((s, q) => s + q.strength, 0);
  // An attacking AI that has lost most of its army withdraws rather than fighting to the last.
  if (side === SIDE_ATTACKER && now / start < cfg.retreatAt && mine.length) { orders.push({ side, type: 'retreatAll' }); return; }
  if (side === SIDE_ATTACKER) thinkAttacker(w, side, orders);
  else if (side === SIDE_DEFENDER) thinkDefender(w, side, orders);
};
