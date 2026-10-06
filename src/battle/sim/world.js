// src/battle/sim/world.js
// The tactical world: plain objects with integer fields, created once from a BattleSetup and then
// mutated only by step() (src/battle/sim/step.js). Everything the sim needs is on the world —
// including the RNG state — so a structuredClone of it is a complete, replayable checkpoint.
import { getUnitBattleStats } from '../data/battleStats';
import { TILE_COST } from '../setup/mapgen';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { initFog } from './fog';
import { HASH_CHAIN_SEED } from './hash';

const tileCenter = (t) => t * Q + (Q >> 1);

// Same split as battle.js's deploy(): strongest first, the first `combatWidth` fight, the rest wait.
// Array.prototype.sort is stable, so equal strengths keep their input order on every engine.
export const splitFrontAndReserve = (units, combatWidth) => {
  const sorted = [...units].sort((a, b) => b.strength - a.strength);
  return { front: sorted.slice(0, combatWidth), reserve: sorted.slice(combatWidth) };
};

const isBackLine = (stats) => !stats.melee && !stats.flying;

const makeSquad = (w, unit, side, ageId, index) => {
  const stats = getUnitBattleStats(unit, ageId); // a ship by its line (D5b), anything else by its class
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
    lastStrikeTick: -10000,                // last tick it swung or fired (drives the strike animation)
    movedSinceAttack: 0,
    order: { type: 'idle' },
    targetKind: null,                      // 'squad' | 'structure'
    target: -1,                            // squad idx or structure index
    groupSpeed: 0,                         // formation speed-matching (0 = own speed)
    anchorX: 0, anchorY: 0,                // where an idle defender returns to
    inside: -1                             // structure index it's garrisoned in (§8.10), -1 = in the open
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
    beachhead: 0,
    spent: [false, false],
    events: [],
    tally: {},
    ended: null,
    stats: { reservesCalled: [0, 0] },
    hashChain: HASH_CHAIN_SEED            // running checkpoint hash (hash.js advanceHashChain)
  };
  spawnSides(w);
  if (setup.deployment === 'blocks') deployBlocks(w);
  initFog(w);
  return w;
};

// The deployment zone of a side, in tiles: the attacker's own zone from mapgen (west of the
// field, the beach for a landing), the defender's the east part of the field up to the keep.
// A `deploy` order (orders.js) and the templates below never place a squad outside it.
export const DEFENDER_ZONE_DEPTH = 16;
export const deployZone = (w, side) => {
  const { map } = w;
  if (side === SIDE_ATTACKER) return map.attackerZone || { x0: map.attackerEdge || 1, y0: 2, x1: 11, y1: map.h - 3 };
  return { x0: Math.max(2, map.keep.x - DEFENDER_ZONE_DEPTH), y0: 2, x1: map.w - 3, y1: map.h - 3 };
};

// Where each side's lines stand before the battle, by battle type (plans/civ-map-rework.md D5,
// the AI's deployment templates): { front, back } tile x per side, and 'column' for an attacker
// that must enter an ambush in file. The default is the field template.
const DEPLOY_TEMPLATES = {
  field: { attacker: (w, e) => [e + 7, e + 3], defender: (w) => [w.map.keep.x - 10, w.map.keep.x - 6] },
  river: { attacker: (w, e) => [Math.min(e + 7, Math.floor(w.map.w / 2) - 3), e + 3], defender: (w) => [Math.floor(w.map.w / 2) + 2, Math.floor(w.map.w / 2) + 5] }, // the defender holds the far bank
  ambush: { attacker: (w, e) => [e + 4, e + 2], defender: (w) => [w.map.keep.x - 14, w.map.keep.x - 11], column: true }, // the defender waits forward in cover; the attacker enters in file
  assault: { attacker: (w, e) => [e + 7, e + 3], defender: (w) => [w.map.keep.x - 6, w.map.keep.x - 3] }, // the garrison keeps close to its walls
  sally: { attacker: (w, e) => [e + 6, e + 3], defender: (w) => [w.map.keep.x - 10, w.map.keep.x - 6] },
  landing: { attacker: (w, e) => [e + 3, e + 1], defender: (w) => [w.map.keep.x - 8, w.map.keep.x - 4] }, // on the sand; the defender a little inland
  naval: { attacker: (w, e) => [e + 7, e + 3], defender: (w) => [w.map.keep.x - 12, w.map.keep.x - 7] } // two lines of ships at sea
};
export const deployTemplate = (type) => DEPLOY_TEMPLATES[type] || DEPLOY_TEMPLATES.field;

// Massed deployment (setup.deployment === 'blocks'; the large-battle presets and the kernel
// benchmark, src/battle/sim/benchScenario.js): every squad of the army starts on the field, in a
// deep block per side facing the other across the middle: columns from the front backward, rows
// across the whole field, melee in front and shooters behind; a slot on impassable ground is skipped.
const BLOCK_SPACING = Math.round(1.5 * Q);
const BLOCK_GAP_TILES = 12; // from the middle of the field to each side's front column
export const deployBlocks = (w) => {
  const { map } = w;
  const rows = Math.floor(((map.h - 8) * Q) / BLOCK_SPACING);
  const y0 = 4 * Q + Math.floor(((map.h - 8) * Q - (rows - 1) * BLOCK_SPACING) / 2);
  const midX = Math.floor(map.w / 2) * Q;
  const passable = (tx, ty) => tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && TILE_COST[map.tiles[ty * map.w + tx]] > 0;
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const mine = w.squads.filter((q) => q.side === side && !q.reinforcement);
    const ordered = [...mine.filter((q) => q.stats.melee), ...mine.filter((q) => !q.stats.melee)];
    const dir = side === SIDE_ATTACKER ? -1 : 1;
    let slot = 0;
    ordered.forEach((q) => {
      for (let tries = 0; tries < 100000; tries++) {
        const col = Math.floor(slot / rows); const row = slot % rows; slot += 1;
        const x = midX + dir * (BLOCK_GAP_TILES * Q + col * BLOCK_SPACING);
        const y = y0 + row * BLOCK_SPACING;
        if (!passable(Math.floor(x / Q), Math.floor(y / Q))) continue;
        q.x = x; q.y = y; q.anchorX = x; q.anchorY = y;
        break;
      }
      q.reserve = false; q.onField = true; q.enterTick = -1;
    });
  });
  return w;
};

// Place each side's front line in formation; reserves wait off-map.
const spawnSides = (w) => {
  const { setup, map } = w;
  const midY = Math.floor(map.h / 2);
  const template = deployTemplate(setup.battleType);
  const massed = setup.deployment === 'blocks';
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const s = setup.sides[side];
    const { front, reserve } = splitFrontAndReserve(s.units.filter((u) => u.strength > 0), massed ? Infinity : setup.combatWidth);
    const squads = front.map((u) => makeSquad(w, u, side, s.ageId, 0));
    const melee = squads.filter((q) => !isBackLine(q.stats));
    const back = squads.filter((q) => isBackLine(q.stats));
    const edge = map.attackerEdge || 1; // a landing deploys on the beach, not in the sea
    const [frontX, backX] = side === SIDE_ATTACKER ? template.attacker(w, edge) : template.defender(w);
    const zone = deployZone(w, side);
    const column = side === SIDE_ATTACKER && template.column;
    [[melee, frontX], [back, backX]].forEach(([line, x]) => {
      line.forEach((q, i) => {
        const offset = Math.round((i - (line.length - 1) / 2) * 3);
        // In column the squads file up along x behind the lead; in line they spread along y.
        const tx = column ? x - Math.abs(offset) : x;
        const ty = column ? midY + (offset > 0 ? 1 : offset < 0 ? -1 : 0) : midY + offset;
        q.x = tileCenter(Math.max(zone.x0, Math.min(zone.x1, tx)));
        q.y = tileCenter(Math.max(zone.y0, Math.min(zone.y1, ty)));
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
// (For an amphibious landing the attacker's edge is the waterline: its troops fall back to the boats.)
export const sideEdgeX = (w, side) => (side === SIDE_ATTACKER ? (w.map.attackerEdge || 1) * Q : (w.map.w - 1) * Q);

export const fieldCount = (w, side) => w.squads.filter((q) => q.side === side && q.alive && !q.fled && (q.onField || q.enterTick >= 0)).length;
export const fieldCap = (w) => w.setup.combatWidth + 2;
