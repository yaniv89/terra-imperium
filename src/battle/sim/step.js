// src/battle/sim/step.js
// One simulation tick, always in the same order (Tactical Battles plan §8.1). step() is the only
// function that advances a world; give it the same world and the same orders and it produces the
// same next world on every device.
import { applyOrders } from './orders';
import { thinkAI } from './tacticalAI';
import { buildSpatialHash } from './pathing';
import { advanceHashChain } from './hash';
import { acquireTargets, enterReserves, moveSquads, separateSquads } from './movement';
import { isFighting, resolveAttacks } from './combat';
import { resolveStructureFire, updateAssimilation, updateCapturePoints, updateSupply, updateGarrisons, ASSIMILATION_TICKS } from './objectives';
import { updateMorale } from './morale';
import { updateFog } from './fog';
import { updateEffects, processImpacts } from './effects';
import { applySupplyAndAttrition } from './support';
import { updateBuildings } from './buildings';
import { updateEconomy, fireEcoTowers, countEcoLosses } from './economy';
import { battleLimitTicks, SIDE_ATTACKER, SIDE_DEFENDER, Q, secondsToTicks } from './constants';
import { LOSS_DECISIVE, RIVER_HOLD_SHARE, AMBUSH_SECONDS, AMBUSH_LOSS, LANDING_HOLD_SECONDS, SALLY_ENGINES } from '../setup/battleType';

const AMBUSH_TICKS = secondsToTicks(AMBUSH_SECONDS);
const LANDING_HOLD_TICKS = secondsToTicks(LANDING_HOLD_SECONDS);

// A side with no squads left on the field sends its whole remaining reserve in, once (last stand).
const lastStand = (w, side) => {
  if (w.lastStandUsed[side]) return;
  const fighting = w.squads.some((q) => q.side === side && !q.worker && isFighting(q) && !q.routed && !q.retreating);
  const entering = w.squads.some((q) => q.side === side && q.alive && q.enterTick >= 0);
  if (fighting || entering) return;
  const waiting = w.squads.filter((q) => q.side === side && q.alive && q.reserve && !q.fled);
  if (!waiting.length || w.retreatOrdered?.[side]) return;
  w.lastStandUsed[side] = true;
  waiting.forEach((q) => { q.enterTick = w.tick + 1; });
  w.events.push({ t: w.tick, type: 'lastStand', side });
};

// Workers (the battle economy) never keep a side in the fight: an army of laborers is a broken one.
const isBroken = (w, side) => !w.squads.some((q) => q.side === side && !q.worker && q.alive && !q.fled && (
  (q.onField && !q.routed && !q.retreating) || q.enterTick >= 0 || (q.reserve && !w.lastStandUsed[side] && !w.retreatOrdered?.[side])
));

// The strength a side still fields (alive, not fled, not routed; reserves count) against what it
// brought: the battle types' loss rules read this (battleType.js).
const startStrength = (w, side) => (w.setup.sides?.[side]?.units || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
const sideStrength = (w, side) => w.squads.reduce((s, q) => s + (q.side === side && !q.worker && q.alive && !q.fled && !q.routed ? q.strength : 0), 0);
const lossShare = (w, side) => { const start = startStrength(w, side); return start > 0 ? 1 - sideStrength(w, side) / start : 0; };
// The share of a side's squads destroyed or fled the field: "rout or destroy 60%" counts squads
// gone for good, so a side breaks only once most of its line has left (a strength share would end
// even fights early for the side that trades worse).
const brokenShare = (w, side) => { // a routed squad may still rally: only the dead and the fled count
  let mine = 0; let gone = 0;
  for (let i = 0; i < w.squads.length; i++) { const q = w.squads[i]; if (q.side !== side || q.worker) continue; mine += 1; if (!q.alive || q.fled) gone += 1; }
  return mine ? gone / mine : 0;
};
// The attacker's strength standing on the far bank (the defender's half of the field).
const farBankStrength = (w) => { const midX = Math.floor(w.map.w / 2) * Q; return w.squads.reduce((s, q) => s + (q.side === SIDE_ATTACKER && q.alive && !q.fled && !q.routed && q.onField && q.x >= midX ? q.strength : 0), 0); };
// A raid or a sack (battleType.js): the loot targets burned so far.
export const lootBurned = (w) => { let n = 0; for (let i = 0; i < w.structures.length; i++) { const s = w.structures[i]; if (s.loot && !s.alive) n += 1; } return n; };
const raidEnd = (w) => {
  const needed = w.setup.raid?.needed ?? 2;
  if (!w.looted && lootBurned(w) >= needed) { w.looted = true; w.events.push({ t: w.tick, type: 'looted', side: SIDE_ATTACKER }); }
  const defenderBroken = isBroken(w, SIDE_DEFENDER);
  // With the loot the raiders run for their edge: the battle lasts until the last of them is off
  // the field (escaped by the exit) or dead. Driven off or killed before they burned enough: the
  // defender's. Nobody left to stop them: theirs. At the clock the loot decides.
  const raidersGone = !w.squads.some((q) => q.side === SIDE_ATTACKER && !q.worker && q.alive && !q.fled && (q.onField || q.enterTick >= 0));
  if (w.looted && raidersGone) w.ended = { outcome: 'attacker', reason: 'escaped', tick: w.tick };
  else if (!w.looted && isBroken(w, SIDE_ATTACKER)) w.ended = { outcome: 'defender', reason: w.retreatOrdered?.[SIDE_ATTACKER] ? 'attackerRetreated' : 'raidersDriven', tick: w.tick };
  else if (defenderBroken) w.ended = { outcome: 'attacker', reason: 'defendersBroken', tick: w.tick };
  else if (w.tick >= battleLimitTicks(w.setup)) w.ended = w.looted ? { outcome: 'attacker', reason: 'looted', tick: w.tick } : { outcome: 'defender', reason: 'timeLimit', tick: w.tick };
  if (w.ended) w.events.push({ t: w.tick, type: 'ended', outcome: w.ended.outcome, reason: w.ended.reason });
};
const campBurned = (w) => { const razed = w.razed || []; return razed.filter((c) => c === 'engine').length >= SALLY_ENGINES || razed.includes('camp'); };

const checkEnd = (w) => {
  const type = w.setup.battleType || 'field';
  if (type === 'raid' || type === 'sack') { raidEnd(w); return; }
  if (w.assimilation >= ASSIMILATION_TICKS) { w.ended = { outcome: 'attacker', reason: 'keepTaken', decisive: true, tick: w.tick }; return; }
  if (type === 'sally' && campBurned(w)) { w.ended = { outcome: 'attacker', reason: 'campBurned', decisive: true, tick: w.tick }; w.events.push({ t: w.tick, type: 'ended', outcome: 'attacker', reason: 'campBurned' }); return; }
  if (type === 'landing') {
    const beach = w.points.find((p) => p.kind === 'beachhead');
    w.beachhead = beach && beach.owner === SIDE_ATTACKER ? (w.beachhead || 0) + 1 : 0;
    if (w.beachhead >= LANDING_HOLD_TICKS) { w.ended = { outcome: 'attacker', reason: 'beachheadHeld', decisive: true, tick: w.tick }; w.events.push({ t: w.tick, type: 'ended', outcome: 'attacker', reason: 'beachheadHeld' }); return; }
  }
  if (type === 'ambush' && w.tick <= AMBUSH_TICKS && lossShare(w, SIDE_ATTACKER) >= AMBUSH_LOSS) { w.ended = { outcome: 'defender', reason: 'ambushed', decisive: true, tick: w.tick }; w.events.push({ t: w.tick, type: 'ended', outcome: 'defender', reason: 'ambushed' }); return; }
  // Field rules (field, river, ambush, landing): a side down LOSS_DECISIVE of its strength breaks
  // and runs (the pursuit then costs it as auto-resolve would), a decisive end for the other side.
  const lossRule = type !== 'assault' && type !== 'sally';
  w.spent = w.spent || [false, false];
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    if (!lossRule || w.spent[side] || brokenShare(w, side) < LOSS_DECISIVE) return;
    w.spent[side] = true;
    w.squads.forEach((q) => { if (q.side === side && q.alive && !q.fled && !q.routed && !(q.inside >= 0)) { q.routed = true; q.morale = 0; w.events.push({ t: w.tick, type: 'routed', id: q.idx }); } });
    w.events.push({ t: w.tick, type: 'sideSpent', side });
  });
  const attackerBroken = isBroken(w, SIDE_ATTACKER);
  const defenderBroken = isBroken(w, SIDE_DEFENDER);
  if (attackerBroken && defenderBroken) w.ended = { outcome: 'stalemate', reason: 'mutualDestruction', tick: w.tick };
  else if (defenderBroken) w.ended = { outcome: 'attacker', reason: w.spent[SIDE_DEFENDER] ? 'lossesDecisive' : 'defendersBroken', decisive: !!w.spent[SIDE_DEFENDER], tick: w.tick };
  else if (attackerBroken) w.ended = { outcome: 'defender', reason: w.retreatOrdered?.[SIDE_ATTACKER] ? 'attackerRetreated' : w.spent[SIDE_ATTACKER] ? 'lossesDecisive' : 'attackersBroken', tick: w.tick };
  else if (w.tick >= battleLimitTicks(w.setup)) {
    // At the clock: a river crossing is won by the far bank; a field battle by the strength left.
    if (type === 'river' && farBankStrength(w) >= RIVER_HOLD_SHARE * startStrength(w, SIDE_ATTACKER)) w.ended = { outcome: 'attacker', reason: 'farBankHeld', decisive: true, tick: w.tick };
    else if ((type === 'field' || type === 'naval') && sideStrength(w, SIDE_ATTACKER) > sideStrength(w, SIDE_DEFENDER) * 1.5) w.ended = { outcome: 'attacker', reason: 'fieldHeld', decisive: false, tick: w.tick };
    else w.ended = { outcome: 'defender', reason: 'timeLimit', tick: w.tick };
  }
  if (w.ended) w.events.push({ t: w.tick, type: 'ended', outcome: w.ended.outcome, reason: w.ended.reason });
};

export const step = (w, orders = []) => {
  if (w.ended) return w;
  updateFog(w); // before anyone decides anything, so the AI never acts on a stale picture
  const all = [...orders];
  (w.setup.controllers || []).forEach((c, side) => { if (c === 'ai') thinkAI(w, side, all); });
  applyOrders(w, all);
  updateEffects(w);
  processImpacts(w);
  updateSupply(w);
  enterReserves(w);
  updateEconomy(w); // workers, construction, training (economy.js; nothing without an economy)
  acquireTargets(w); // builds its own enemy-only grid (pathing.js buildTargetGrid)
  moveSquads(w);
  buildSpatialHash(w);
  separateSquads(w);
  resolveAttacks(w);
  resolveStructureFire(w);
  fireEcoTowers(w);
  updateGarrisons(w); // squads that reached their building go in; failing buildings throw theirs out
  applySupplyAndAttrition(w);
  updateBuildings(w);
  updateMorale(w);
  updateCapturePoints(w);
  updateAssimilation(w);
  countEcoLosses(w);
  lastStand(w, SIDE_ATTACKER);
  lastStand(w, SIDE_DEFENDER);
  checkEnd(w);
  w.tick += 1;
  advanceHashChain(w); // every HASH_CHAIN_EVERY ticks (hash.js)
  return w;
};
