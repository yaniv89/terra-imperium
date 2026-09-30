// src/battle/sim/step.js
// One simulation tick, always in the same order (Tactical Battles plan §8.1). step() is the only
// function that advances a world; give it the same world and the same orders and it produces the
// same next world on every device.
import { applyOrders } from './orders';
import { thinkAI } from './tacticalAI';
import { buildSpatialHash } from './pathing';
import { acquireTargets, enterReserves, moveSquads, separateSquads } from './movement';
import { isFighting, resolveAttacks } from './combat';
import { resolveStructureFire, updateAssimilation, updateCapturePoints, updateSupply, ASSIMILATION_TICKS } from './objectives';
import { updateMorale } from './morale';
import { BATTLE_LIMIT_TICKS, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';

// A side with no squads left on the field sends its whole remaining reserve in, once (last stand).
const lastStand = (w, side) => {
  if (w.lastStandUsed[side]) return;
  const fighting = w.squads.some((q) => q.side === side && isFighting(q) && !q.routed && !q.retreating);
  const entering = w.squads.some((q) => q.side === side && q.alive && q.enterTick >= 0);
  if (fighting || entering) return;
  const waiting = w.squads.filter((q) => q.side === side && q.alive && q.reserve && !q.fled);
  if (!waiting.length || w.retreatOrdered?.[side]) return;
  w.lastStandUsed[side] = true;
  waiting.forEach((q) => { q.enterTick = w.tick + 1; });
  w.events.push({ t: w.tick, type: 'lastStand', side });
};

const isBroken = (w, side) => !w.squads.some((q) => q.side === side && q.alive && !q.fled && (
  (q.onField && !q.routed && !q.retreating) || q.enterTick >= 0 || (q.reserve && !w.lastStandUsed[side] && !w.retreatOrdered?.[side])
));

const checkEnd = (w) => {
  if (w.assimilation >= ASSIMILATION_TICKS) { w.ended = { outcome: 'attacker', reason: 'keepTaken', decisive: true, tick: w.tick }; return; }
  const attackerBroken = isBroken(w, SIDE_ATTACKER);
  const defenderBroken = isBroken(w, SIDE_DEFENDER);
  if (attackerBroken && defenderBroken) w.ended = { outcome: 'stalemate', reason: 'mutualDestruction', tick: w.tick };
  else if (defenderBroken) w.ended = { outcome: 'attacker', reason: 'defendersBroken', decisive: false, tick: w.tick };
  else if (attackerBroken) w.ended = { outcome: 'defender', reason: w.retreatOrdered?.[SIDE_ATTACKER] ? 'attackerRetreated' : 'attackersBroken', tick: w.tick };
  else if (w.tick >= BATTLE_LIMIT_TICKS) w.ended = { outcome: 'defender', reason: 'timeLimit', tick: w.tick };
  if (w.ended) w.events.push({ t: w.tick, type: 'ended', outcome: w.ended.outcome, reason: w.ended.reason });
};

export const step = (w, orders = []) => {
  if (w.ended) return w;
  const all = [...orders];
  (w.setup.controllers || []).forEach((c, side) => { if (c === 'ai') thinkAI(w, side, all); });
  applyOrders(w, all);
  updateSupply(w);
  enterReserves(w);
  buildSpatialHash(w);
  acquireTargets(w);
  moveSquads(w);
  buildSpatialHash(w);
  separateSquads(w);
  resolveAttacks(w);
  resolveStructureFire(w);
  updateMorale(w);
  updateCapturePoints(w);
  updateAssimilation(w);
  lastStand(w, SIDE_ATTACKER);
  lastStand(w, SIDE_DEFENDER);
  checkEnd(w);
  w.tick += 1;
  return w;
};
