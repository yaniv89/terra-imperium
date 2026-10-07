// Phase R3 step 3, decision 34: manned forts start field battles; forts have zone of control; armies
// cross rivers at extra movement cost and river battles use the river maps (src/engine/forts.js,
// armies.js, plans/MASTER-PLAN.md 6.9).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { syncWorldRegistry } from './world/registry';
import { resolveTurn } from './resolveTurn';
import { processFortBattles, fortChallenges, isFortTile, fortGarrison, FORT_BATTLE_LEVEL } from './forts';
import { inEnemyZoc, tileStepCost, riverCrossingCost } from './armies';
import { resolveQueuedAuto, queuedBattleView } from './battleQueue';
import { buildInvasionSetup, buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { tileContextOf } from '../battle/setup/tileContext';
import { battleTypeOf } from '../battle/setup/battleType';
import { TILE } from '../battle/setup/mapgen';
import { HISTORICAL_EVENTS } from '../data/events';

const tiles = getTiles();
const IN = getNationCapital('in'); const PK = getNationCapital('pk');
const unit = (id, owner, regionId, tile, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });

// India (the player) at war with Pakistan; a fort on Pakistani land with a free approach: `start`
// two steps out, `beside` next to the fort.
const world = ({ player = 'in', garrison = true, fortOwner = 'pk' } = {}) => {
  const s0 = syncWorldRegistry(createInitialState({ playerNationId: player, rngSeed: 3 }));
  const centres = new Set(Object.values(s0.regions).map((r) => r.tile));
  const land = (t) => tiles.land[t] === 1 && !centres.has(t);
  const own = s0.regions[fortOwner === 'pk' ? PK : IN];
  let pick = null;
  for (const f of (own.tiles || []).filter(land)) {
    for (const b of tiles.neighbors[f].filter(land)) {
      const st = tiles.neighbors[b].find((t) => land(t) && t !== f && !tiles.neighbors[f].includes(t) && !tiles.neighbors[t].some((n) => n === f));
      if (st != null) { pick = { fort: f, beside: b, start: st }; break; }
    }
    if (pick) break;
  }
  const tileState = { ...s0.world.tileState, [pick.fort]: { ...(s0.world.tileState[pick.fort] || {}), improvement: 'fort' } };
  const owner = fortOwner; const other = fortOwner === 'pk' ? 'in' : 'pk';
  const units = {
    ...(garrison ? { g1: unit('g1', owner, owner === 'pk' ? PK : IN, pick.fort) } : {}),
    m1: unit('m1', other, other === 'pk' ? PK : IN, pick.beside), m2: unit('m2', other, other === 'pk' ? PK : IN, pick.beside)
  };
  const startUnits = { ...units, m1: { ...units.m1, tile: pick.start }, m2: { ...units.m2, tile: pick.start } };
  return {
    s: {
      ...s0, units, world: { ...s0.world, tileState },
      wars: [...s0.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: s0.year, battleScore: 0 }],
      nations: { ...s0.nations, in: { ...s0.nations.in, isAtWar: true }, pk: { ...s0.nations.pk, isAtWar: true, economy: { gold: 1000, hr: 1000, mil: 100, adm: 100 } } },
      pendingDefenses: [], battleSettings: { autoDefend: false }
    },
    startUnits, ...pick
  };
};

describe('forts: zone of control', () => {
  it('a fort, manned or not, ends an enemy move beside it; never its owner\'s', () => {
    const { s, fort, beside } = world({ garrison: false });
    expect(isFortTile(s, fort)).toBe(true);
    expect(fortGarrison(s, fort)).toHaveLength(0);
    const noArmies = { ...s, units: {} };
    expect(inEnemyZoc(noArmies, tiles, beside, 'in')).toBe(true);
    expect(inEnemyZoc(noArmies, tiles, beside, 'pk')).toBe(false);
    // Pillaged, it is no fort.
    const pillaged = { ...noArmies, world: { ...s.world, tileState: { ...s.world.tileState, [fort]: { improvement: 'fort', pillaged: true } } } };
    expect(inEnemyZoc(pillaged, tiles, beside, 'in')).toBe(false);
  });

  it('an unmanned fort only slows: no battle', () => {
    const { s, startUnits } = world({ garrison: false });
    expect(fortChallenges(s, startUnits)).toEqual([]);
    expect(processFortBattles(s, startUnits)).toBe(s);
  });

  it('an army that was already beside the fort when the turn began is not stopped again', () => {
    const { s } = world();
    expect(fortChallenges(s, s.units)).toEqual([]);
  });
});

describe('forts start battles (decision 34)', () => {
  it('the player\'s army stopped beside an enemy fort must fight: queued, Command or Auto, the fort on the map', () => {
    const { s, startUnits, fort } = world();
    const next = processFortBattles(s, startUnits);
    expect(next.pendingDefenses).toHaveLength(1);
    const def = next.pendingDefenses[0];
    expect(def).toMatchObject({ kind: 'field', fort: true, aggressorId: 'in', tile: fort });
    expect(def.attackerUnitIds.sort()).toEqual(['m1', 'm2']);
    expect(def.defenderUnitIds).toEqual(['g1']);
    expect(next.units.m1.movesLeft).toBe(0);
    expect(resolveTurn(next)).toBe(next);
    expect(queuedBattleView(next, def, 4).name).toMatch(/^Battle of /);
    const began = gameReducer(next, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    expect(began.pendingBattle).toMatchObject({ kind: 'field', playerSide: 'attacker', attackerNationId: 'in', defenderNationId: 'pk', fort: true });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.controllers).toEqual(['player', 'ai']);
    expect(setup.modifiers.isAttackingFortification).toBe(true);
    const keep = setup.structures.find((x) => x.kind === 'keep');
    expect(keep.walls).toBe(true); // FORT_BATTLE_LEVEL: a walled keep
    expect(keep.damage).toBeGreaterThan(0);
    expect(FORT_BATTLE_LEVEL).toBeGreaterThanOrEqual(2);
    const auto = resolveQueuedAuto(next, def.id);
    expect(auto.pendingDefenses).toHaveLength(0);
    expect(auto.appliedBattleIds).toContain(def.id);
    expect(auto.battleReports[0]).toMatchObject({ kind: 'field', attackerNationId: 'in', defenderNationId: 'pk' });
  });

  it('an AI army stopped beside the player\'s fort: the player defends it', () => {
    const { s, startUnits, fort } = world({ fortOwner: 'in' });
    const next = processFortBattles(s, startUnits);
    const def = next.pendingDefenses[0];
    expect(def).toMatchObject({ aggressorId: 'pk', tile: fort, fort: true });
    const began = gameReducer(next, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    expect(began.pendingBattle).toMatchObject({ playerSide: 'defender', attackerNationId: 'pk' });
    expect(buildInvasionSetup(began, began.pendingBattle).controllers).toEqual(['ai', 'player']);
  });

  it('AI against AI is fought on Auto at once', () => {
    const { s, startUnits } = world({ player: 'cn' });
    const next = processFortBattles(s, startUnits);
    expect(next.pendingDefenses).toHaveLength(0);
    expect([next.units.g1?.lastBattleTurn, next.units.m1?.lastBattleTurn, next.units.m2?.lastBattleTurn].some((t) => t === s.turnNumber)).toBe(true);
  });

  it('through resolveTurn: a march beside a manned fort halts there and the fort starts the battle', () => {
    const { s, start, beside, fort } = world();
    const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
    const marching = { ...s, firedEvents, proceduralEventCooldown: 999999, units: { ...s.units, m1: { ...s.units.m1, tile: start, route: [beside], routePace: 4, routeBank: 0 }, m2: { ...s.units.m2, tile: start, route: [beside], routePace: 4, routeBank: 0 } } };
    const after = resolveTurn(marching);
    expect(after.units.m1.tile).toBe(beside);
    const rec = after.pendingDefenses.find((d) => d.fort);
    expect(rec).toMatchObject({ aggressorId: 'in', tile: fort });
  }, 120000);
});

describe('rivers (decision 34)', () => {
  // A river edge between two passable land tiles that are not city centres.
  const riverEdge = () => {
    for (let t = 0; t < tiles.land.length; t++) {
      if (tiles.land[t] !== 1 || tiles.terrainOf(t) === 'snow') continue;
      const n = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && tiles.riverSizeBetween(t, x) > 0);
      if (n != null) return [t, n];
    }
    return null;
  };

  it('armies cross a river at extra movement cost', () => {
    const [a, b] = riverEdge();
    const s = createInitialState({ playerNationId: 'in', rngSeed: 3 });
    const size = tiles.riverSizeBetween(a, b);
    const across = tileStepCost(s, tiles, a, b);
    const noRiver = tileStepCost(s, tiles, null, b);
    expect(across).toBeCloseTo(noRiver + riverCrossingCost(size));
    expect(across).toBeGreaterThan(noRiver);
  });

  it('a battle on a river tile puts the river on the battle map with fords; attacking across it is a river crossing', () => {
    const [a, b] = riverEdge();
    const s = createInitialState({ playerNationId: 'in', rngSeed: 3 });
    const ctx = tileContextOf(s, b, { fromTile: a });
    const sector = ctx.sectors.find((x) => x.tile === a);
    expect(sector.river).toBe(true);
    expect(sector.fords).toBeGreaterThan(0);
    expect(battleTypeOf({ tileContext: ctx, fromTile: a })).toBe('river');
    const mk = (p) => [0, 1].map((i) => ({ id: `${p}${i}`, classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
    const setup = buildSetupFromArmies({ regionId: 'river', terrain: ctx.terrain, seed: 1, attackerUnits: mk('a'), defenderUnits: mk('d'), tileContext: ctx, fromTile: a, city: false, deposits: [], powers: [[], []] });
    expect(setup.battleType).toBe('river');
    expect(Array.from(setup.map.tiles).some((t) => t === TILE.FORD)).toBe(true);
  });
});
