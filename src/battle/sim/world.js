// src/battle/sim/world.js
// The tactical world: plain objects with integer fields, created once from a BattleSetup and then
// mutated only by step() (src/battle/sim/step.js). Everything the sim needs is on the world —
// including the RNG state — so a structuredClone of it is a complete, replayable checkpoint.
import { getBattleStats } from '../data/battleStats';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { initFog } from './fog';

const tileCenter = (t) => t * Q + (Q >> 1);

// Same split as battle.js's deploy(): strongest first, the first `combatWidth` fight, the rest wait.
// Array.prototype.sort is stable, so equal strengths keep their input order on every engine.
export const splitFrontAndReserve = (units, combatWidth) => {
  const sorted = [...units].sort((a, b) => b.strength - a.strength);
  return { front: sorted.slice(0, combatWidth), reserve: sorted.slice(combatWidth) };
};

const isBackLine = (stats) => !stats.melee && !stats.flying;

const makeSquad = (w, unit, side, ageId, index) => {
  const stats = getBattleStats(unit.classId, ageId);
  return {
    idx: index,
    unitId: unit.id,
    side,
    classId: unit.classId,
    ageId,
    stats,
    original: unit,                        // the strategic unit object, returned (updated) in the result
    x: 0, y: 0, facing: side === SIDE_ATTACKER ? 0 : 128,
    strength: Math.max(0, Math.round(unit.strength)),
    startStrength: Math.max(0, Math.round(unit.strength)),
    maxStrength: Math.max(1, Math.round(unit.maxStrength || unit.strength || 1)),
    morale: Math.max(0, Math.min(100, Math.round(unit.morale ?? 100))),
    promotions: unit.promotions || [],
    commanderId: unit.commanderId || null,
    alive: unit.strength > 0,
    onField: false,
    reserve: false,
    enterTick: -1,                         // tick at which a called reserve walks onto the field
    fled: false,                           // left the field (routed or retreated) — survives strategically
    routed: false,
    retreating: false,                     // orderly withdrawal ordered by its commander
    routImmunityUsed: false,
    engaged: false,                        // dealt or took damage at least once (earns battle XP)
    damageDealt: 0,
    cooldown: 0,
    lastHitTick: -10000,
    movedSinceAttack: 0,
    order: { type: 'idle' },
    targetKind: null,                      // 'squad' | 'structure'
    target: -1,                            // squad idx or structure index
    groupSpeed: 0,                         // formation speed-matching (0 = own speed)
    anchorX: 0, anchorY: 0                 // where an idle defender returns to
  };
};

export const createWorld = (setup) => {
  const w = {
    version: 1,
    tick: 0,
    rngState: setup.seed >>> 0,
    setup,
    map: setup.map,
    squads: [],
    structures: setup.structures.map((s) => ({ ...s })),
    points: setup.points.map((p) => ({ ...p })),
    supply: [setup.startSupply?.[0] ?? 100, setup.startSupply?.[1] ?? 100],
    lastStandUsed: [false, false],
    effects: [],
    impacts: [],
    powersUsed: [{}, {}],
    powerCooldowns: [{}, {}],
    assimilation: 0,
    events: [],
    tally: {},
    ended: null,
    stats: { reservesCalled: [0, 0] }
  };
  spawnSides(w);
  initFog(w);
  return w;
};

// Place each side's front line in formation; reserves wait off-map.
const spawnSides = (w) => {
  const { setup, map } = w;
  const midY = Math.floor(map.h / 2);
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const s = setup.sides[side];
    const { front, reserve } = splitFrontAndReserve(s.units.filter((u) => u.strength > 0), setup.combatWidth);
    const squads = front.map((u) => makeSquad(w, u, side, s.ageId, 0));
    const melee = squads.filter((q) => !isBackLine(q.stats));
    const back = squads.filter((q) => isBackLine(q.stats));
    const frontX = side === SIDE_ATTACKER ? 8 : map.keep.x - 10;
    const backX = side === SIDE_ATTACKER ? 4 : map.keep.x - 6;
    [[melee, frontX], [back, backX]].forEach(([line, x]) => {
      line.forEach((q, i) => {
        const offset = Math.round((i - (line.length - 1) / 2) * 3);
        q.x = tileCenter(x);
        q.y = tileCenter(Math.max(2, Math.min(map.h - 3, midY + offset)));
        q.onField = true;
        q.anchorX = q.x; q.anchorY = q.y;
      });
    });
    reserve.forEach((u) => { const q = makeSquad(w, u, side, s.ageId, 0); q.reserve = true; squads.push(q); });
    // Reinforcements waiting in neighbouring provinces (RoN Conquer the World): callable with
    // Battle Supply, they march in from the edge facing the province they come from.
    (s.reinforcements || []).forEach((src) => src.units.filter((u) => u.strength > 0).forEach((u) => {
      const q = makeSquad(w, u, side, s.ageId, 0);
      q.reserve = true;
      q.reinforcement = { regionId: src.regionId, name: src.name, edge: src.edge };
      squads.push(q);
    }));
    squads.forEach((q) => { q.idx = w.squads.length; w.squads.push(q); });
  });
};

// The tile x a side enters the field on (and flees toward).
export const sideEdgeX = (w, side) => (side === SIDE_ATTACKER ? Q : (w.map.w - 1) * Q);

export const fieldCount = (w, side) => w.squads.filter((q) => q.side === side && q.alive && !q.fled && (q.onField || q.enterTick >= 0)).length;
export const fieldCap = (w) => w.setup.combatWidth + 2;
