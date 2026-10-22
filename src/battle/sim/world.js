// src/battle/sim/world.js
// The tactical world: plain objects with integer fields, created once from a BattleSetup and then
// mutated only by step() (src/battle/sim/step.js). Everything the sim needs is on the world —
// including the RNG state — so a structuredClone of it is a complete, replayable checkpoint.
import { getUnitBattleStats } from '../data/battleStats';
import { TILE_COST } from '../setup/mapgen';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER, secondsToTicks } from './constants';
import { POP_LIMIT } from '../data/economy';
import { initFog } from './fog';
import { HASH_CHAIN_SEED } from './hash';
import { tileOf, walkableGoal } from './pathing';
import { initEconomy } from './economy';
import { reserveEntryMult } from './buildings';
import { emptyLosses } from './losses';
import { guardClassOf } from '../../data/unitClasses';

const tileCenter = (t) => t * Q + (Q >> 1);

// Strongest first, the first `limit` take the field, the rest stay out of the battle.
// Array.prototype.sort is stable, so equal strengths keep their input order on every engine.
export const splitFrontAndReserve = (units, limit) => {
  const sorted = [...units].sort((a, b) => b.strength - a.strength);
  return { front: sorted.slice(0, limit), reserve: sorted.slice(limit) };
};

// U10 (the user's ruling Q2): no Reserve. Every regiment of the army starts on the field; there is
// no call and no later wave. Armies stay well under the 300-a-side population limit, so this cap is
// only a guard: past it the weakest regiments stay out of the battle untouched (result.js reports
// them as 'reserve': the campaign keeps them as they were). They never enter.
export const MAX_START_SQUADS = POP_LIMIT;
// Allied reinforcements from neighbouring provinces are not a reserve either: nobody calls them,
// they march in from their own edge on their own, this long after the battle starts (sooner for a
// defender whose Barracks stands: buildings.js reserveEntryMult).
export const REINFORCEMENT_ARRIVAL_TICKS = secondsToTicks(25);
// A line of squads a side deploys: 3 tiles apart across the field; a longer line forms more ranks,
// RANK_DEPTH tiles apart, behind the first.
const LINE_SPACING = 3;
const RANK_DEPTH = 2;

const isBackLine = (stats) => !stats.melee && !stats.flying;

export const makeSquad = (w, unit, side, sideAgeId, index) => {
  const ageId = unit.ageId || sideAgeId; // a unit keeps the age it was built in (unitUpgrades.js)
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
    attritionOwed: 0,                      // attrition owed, in thousandths of a strength point (support.js)
    lossBy: emptyLosses(),                 // strength lost by cause (losses.js): bookkeeping, never hashed
    cooldown: 0,
    lastHitTick: -10000,
    lastStrikeTick: -10000,                // last tick it swung or fired (drives the strike animation)
    // Future shields (combat.js): stats.shield is a percent of full strength; it soaks hits first.
    shield: stats.shield ? Math.round((Math.max(1, Math.round(unit.maxStrength || unit.strength || 1)) * stats.shield) / 100) : 0,
    maxShield: stats.shield ? Math.round((Math.max(1, Math.round(unit.maxStrength || unit.strength || 1)) * stats.shield) / 100) : 0,
    suppressedUntil: -1,                   // a machine gun's suppression fires slower until this tick (effects.js)
    lastDepositTick: -10000,               // a worker's last drop-off (drawing only: never read by the sim, never hashed)
    noPathTick: -10000,                    // last tick its way to an order's goal was cut off (movement.js; drawing only, never hashed)
    movedSinceAttack: 0,
    stepTick: -1, stepHeading: 0,          // tick and heading of its last step (movement.js; read that tick only, never hashed)
    order: { type: 'idle' },
    targetKind: null,                      // 'squad' | 'structure'
    target: -1,                            // squad idx or structure index
    // An 'attack' order on a building that a squad broke off to fight back (U11): it goes back to
    // that building once the fight is over ('structure' | 'eco' and its index; null = nothing).
    resumeKind: null, resumeTarget: -1,
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
    // A city's structures turn their ground to rubble as they fall: the world gets its own tiles.
    // (and the battle economy raises buildings on it).
    map: setup.city || setup.economy ? { ...setup.map, tiles: setup.map.tiles.slice() } : setup.map,
    squads: [],
    structures: setup.structures.map((s) => ({ ...s })),
    points: setup.points.map((p) => ({ ...p })),
    supply: [setup.startSupply?.[0] ?? 100, setup.startSupply?.[1] ?? 100],
    effects: [],
    impacts: [],
    powersUsed: [{}, {}],
    powerCooldowns: [{}, {}],
    jammedUntil: [-1, -1], // Cyber Jam (effects.js): a side's orders wait until this tick
    jammedOrders: [],
    assimilation: 0,
    beachhead: 0,
    spent: [false, false],
    events: [],
    tally: {},
    ended: null,
    stats: { reservesCalled: [0, 0] },
    hashChain: HASH_CHAIN_SEED            // running checkpoint hash (hash.js advanceHashChain)
  };
  // A walled city's closed gate: each side walks on its own flow fields (pathing.js getFlowField).
  if (setup.city && w.structures.some((s) => s.kind === 'gate' && s.footprint?.length)) w.map.gated = true;
  spawnSides(w);
  if (setup.deployment === 'blocks') deployBlocks(w);
  initFog(w);
  initEconomy(w); // the battle economy (phase R1): only when the setup has one
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
export const NAVAL_GAP = 6; // tiles from the middle of the sea to each fleet's front line
const DEPLOY_TEMPLATES = {
  field: { attacker: (w, e) => [e + 7, e + 3], defender: (w) => [w.map.keep.x - 10, w.map.keep.x - 6] },
  river: { attacker: (w, e) => [Math.min(e + 7, Math.floor(w.map.w / 2) - 3), e + 3], defender: (w) => [Math.floor(w.map.w / 2) + 2, Math.floor(w.map.w / 2) + 5] }, // the defender holds the far bank
  ambush: { attacker: (w, e) => [e + 4, e + 2], defender: (w) => [w.map.keep.x - 14, w.map.keep.x - 11], column: true }, // the defender waits forward in cover; the attacker enters in file
  assault: { attacker: (w, e) => [e + 7, e + 3], defender: (w) => [w.map.keep.x - 6, w.map.keep.x - 3] }, // the garrison keeps close to its walls
  sally: { attacker: (w, e) => [e + 6, e + 3], defender: (w) => [w.map.keep.x - 10, w.map.keep.x - 6] },
  landing: { attacker: (w, e) => [e + 3, e + 1], defender: (w) => [w.map.keep.x - 8, w.map.keep.x - 4] }, // on the sand; the defender a little inland
  // Two lines of ships facing each other across the middle of the sea, close enough to meet at once.
  naval: { attacker: (w) => [Math.floor(w.map.w / 2) - NAVAL_GAP, Math.floor(w.map.w / 2) - NAVAL_GAP - 4], defender: (w) => [Math.floor(w.map.w / 2) + NAVAL_GAP, Math.floor(w.map.w / 2) + NAVAL_GAP + 4] }
};
export const deployTemplate = (type) => DEPLOY_TEMPLATES[type] || DEPLOY_TEMPLATES.field;

// Massed deployment (setup.deployment === 'blocks'; the large-battle presets and the kernel
// benchmark, src/battle/bench/benchScenario.js): every squad of the army starts on the field, in a
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

// Place each side's whole army in formation (U10: no reserve waits off-map).
const spawnSides = (w) => {
  const { setup, map } = w;
  const midY = Math.floor(map.h / 2);
  const template = deployTemplate(setup.battleType);
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const s = setup.sides[side];
    const { front, reserve } = splitFrontAndReserve(s.units.filter((u) => u.strength > 0), MAX_START_SQUADS);
    const squads = front.map((u) => makeSquad(w, u, side, s.ageId, 0));
    const melee = squads.filter((q) => !isBackLine(q.stats));
    const back = squads.filter((q) => isBackLine(q.stats));
    const edge = map.attackerEdge || 1; // a landing deploys on the beach, not in the sea
    const [frontX, baseBackX] = side === SIDE_ATTACKER ? template.attacker(w, edge) : template.defender(w);
    const zone = deployZone(w, side);
    const column = side === SIDE_ATTACKER && template.column;
    // How many squads one rank holds across the zone; a bigger line forms ranks behind it, and the
    // shooters stand behind the last rank of the melee line.
    const perRank = Math.max(1, Math.floor((zone.y1 - zone.y0) / LINE_SPACING) + 1);
    const behind = side === SIDE_ATTACKER ? -1 : 1;
    const meleeRanks = Math.ceil(melee.length / perRank);
    const backShift = Math.max(0, (meleeRanks - 1) * RANK_DEPTH - Math.abs(frontX - baseBackX) + RANK_DEPTH);
    const backX = baseBackX + behind * backShift;
    [[melee, frontX], [back, backX]].forEach(([line, x]) => {
      line.forEach((q, i) => {
        const rank = column ? 0 : Math.floor(i / perRank);
        const inRank = column ? line.length : Math.min(perRank, line.length - rank * perRank);
        const offset = Math.round(((column ? i : i % perRank) - (inRank - 1) / 2) * LINE_SPACING);
        // In column the squads file up along x behind the lead; in line they spread along y.
        const tx = column ? x - Math.abs(offset) : x + behind * RANK_DEPTH * rank;
        const ty = column ? midY + (offset > 0 ? 1 : offset < 0 ? -1 : 0) : midY + offset;
        q.x = tileCenter(Math.max(zone.x0, Math.min(zone.x1, tx)));
        q.y = tileCenter(Math.max(zone.y0, Math.min(zone.y1, ty)));
        // in a city a slot may fall on a house: the nearest open ground instead
        if ((setup.city || setup.economy) && !TILE_COST[map.tiles[tileOf(map, q.x, q.y)]]) {
          const i = walkableGoal(map, tileOf(map, q.x, q.y));
          q.x = tileCenter(i % map.w); q.y = tileCenter(Math.floor(i / map.w));
        }
        q.onField = true;
        q.anchorX = q.x; q.anchorY = q.y;
      });
    });
    // Past the cap (a guard only): left out of the battle, never called.
    reserve.forEach((u) => { const q = makeSquad(w, u, side, s.ageId, 0); q.reserve = true; q.heldBack = true; squads.push(q); });
    // Reinforcements from neighbouring provinces (RoN Conquer the World): they march in on their
    // own (REINFORCEMENT_ARRIVAL_TICKS), from the edge facing the province they come from.
    (s.reinforcements || []).forEach((src) => src.units.filter((u) => u.strength > 0).forEach((u) => {
      const q = makeSquad(w, u, side, s.ageId, 0);
      q.reserve = true;
      q.enterTick = Math.round(REINFORCEMENT_ARRIVAL_TICKS * reserveEntryMult(w, side));
      q.reinforcement = { regionId: src.regionId, name: src.name, edge: src.edge };
      squads.push(q);
    }));
    squads.forEach((q) => { q.idx = w.squads.length; w.squads.push(q); });
  });
  spawnGenerals(w);
};

// A general is a unit on the field (master plan 6.7 row 5; phase R3): every general commanding one
// of a side's units rides with a small guard (GENERAL_GUARD strength of cavalry) behind its line.
// Its aura steadies the troops near it (effects.js generalAura) and keeps them supplied
// (support.js); it can be killed: a general whose guard falls is struck down, and the campaign rolls
// the shared COMMANDER_FALL_CHANCE for it (aftermath.js), as Auto does for a destroyed unit's
// general. The guard is not a campaign unit (eco: left out of the result and the field cap) and a
// side with only its generals left is broken.
export const GENERAL_GUARD = 120;
const spawnGenerals = (w) => {
  const { setup, map } = w;
  const generals = setup.generals || {};
  if (!Object.keys(generals).length) return;
  const midY = Math.floor(map.h / 2);
  const template = deployTemplate(setup.battleType);
  [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
    const s = setup.sides[side];
    const ids = [...new Set((s.units || []).filter((u) => u.strength > 0 && u.commanderId && generals[u.commanderId]).map((u) => u.commanderId))].sort();
    if (!ids.length) return;
    const edge = map.attackerEdge || 1;
    const zone = deployZone(w, side);
    const behind = side === SIDE_ATTACKER ? -1 : 1;
    // The guard stands one full line pitch (LINE_SPACING tiles) behind the side's rearmost squad
    // as deployed, never inside the back line: machines and chariots there drew over it (CB20,
    // SETUP_VERSION 11). The rear is read from the placed squads, so deep armies push it back too.
    const placed = w.squads.filter((q) => q.side === side && q.onField && !q.reserve);
    const templateBack = side === SIDE_ATTACKER ? template.attacker(w, edge)[1] : template.defender(w)[1];
    const rearX = placed.length
      ? placed.reduce((r, q) => (behind < 0 ? Math.min(r, Math.floor(q.x / Q)) : Math.max(r, Math.floor(q.x / Q))), Math.floor(placed[0].x / Q))
      : templateBack;
    const genX = Math.max(zone.x0, Math.min(zone.x1, rearX + behind * LINE_SPACING));
    // No room behind (the rear rank stands at the zone's edge): the guard takes the flank of the
    // rear rank instead, one pitch past its outermost squad.
    const cramped = Math.abs(genX - rearX) < LINE_SPACING;
    const rearSpan = cramped
      ? placed.filter((q) => Math.abs(Math.floor(q.x / Q) - genX) < LINE_SPACING).reduce((m, q) => Math.max(m, Math.abs(Math.floor(q.y / Q) - midY)), 0)
      : 0;
    ids.forEach((cid, i) => {
      // At sea the admiral sails in a flagship (a warship), never a land guard on the water.
      const guard = setup.battleType === 'naval' ? { classId: 'naval', navalLine: 'warship', domain: 'naval' } : { classId: guardClassOf(s.ageId), domain: 'land' };
      const unit = { id: `gen_${cid}`, ...guard, strength: GENERAL_GUARD, maxStrength: GENERAL_GUARD, morale: 100, promotions: [], commanderId: cid };
      const q = makeSquad(w, unit, side, s.ageId, w.squads.length);
      q.isGeneral = cid; q.eco = 'general';
      q.x = tileCenter(genX);
      const ty = cramped
        ? midY + (i % 2 ? 1 : -1) * (rearSpan + LINE_SPACING * (1 + Math.floor(i / 2)))
        : midY + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * LINE_SPACING;
      q.y = tileCenter(Math.max(zone.y0, Math.min(zone.y1, ty)));
      if ((setup.city || setup.economy) && !TILE_COST[map.tiles[tileOf(map, q.x, q.y)]]) {
        const g = walkableGoal(map, tileOf(map, q.x, q.y));
        q.x = tileCenter(g % map.w); q.y = tileCenter(Math.floor(g / map.w));
      }
      q.onField = true; q.anchorX = q.x; q.anchorY = q.y;
      w.squads.push(q);
    });
  });
};

// The tile x a side enters the field on (and flees toward).
// (For an amphibious landing the attacker's edge is the waterline: its troops fall back to the boats.)
export const sideEdgeX = (w, side) => (side === SIDE_ATTACKER ? (w.map.attackerEdge || 1) * Q : (w.map.w - 1) * Q);

