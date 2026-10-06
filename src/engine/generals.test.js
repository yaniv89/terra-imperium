// Phase R3 step 5 (plans/MASTER-PLAN.md 6.7 row 5): a general is a unit on the battle map, with an
// aura, and can die; one death rule (COMMANDER_FALL_CHANCE) shared by Command and Auto.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { createWorld, GENERAL_GUARD } from '../battle/sim/world';
import { step } from '../battle/sim/step';
import { toStrategicResult } from '../battle/sim/result';
import { runHeadless } from '../battle/sim/headless';
import { generalAura } from '../battle/sim/effects';
import { generalsOf } from '../battle/sim/squadLists';
import { resolveCommanderCasualties, hashRoll, COMMANDER_FALL_CHANCE } from './aftermath';
import { sanitizeTacticalResult, createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { createRng } from '../utils/rng';
import { aiSally } from './aiOperations';
import { syncWorldRegistry } from './world/registry';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';

const GENERALS = { c1: { id: 'c1', name: 'Hannibal', personality: 'aggressive', skill: 2 } };
const army = (p, cls, cmd = null) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: i === 0 ? cmd : null, domain: 'land' }));
const setup = (seed = 1, cmd = 'c1') => buildSetupFromArmies({ regionId: `g-${seed}`, terrain: 'plains', seed, attackerUnits: army('a', ['infantry', 'infantry', 'cavalry'], cmd), defenderUnits: army('d', ['infantry', 'infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: 'field', generals: GENERALS });

describe('the general on the battle map', () => {
  it('rides with a guard behind its army, not a campaign unit, with an aura over the troops near it', () => {
    const w = createWorld(setup());
    const gens = generalsOf(w);
    expect(gens).toHaveLength(1);
    const g = gens[0];
    expect(g).toMatchObject({ isGeneral: 'c1', side: 0, strength: GENERAL_GUARD, eco: 'general', commanderId: 'c1' });
    // Behind the attacker's line (the attacker deploys west, so behind is further west).
    const line = w.squads.filter((q) => q.side === 0 && !q.isGeneral);
    expect(g.x).toBeLessThan(Math.min(...line.map((q) => q.x)));
    expect(line.some((q) => generalAura(w, q))).toBe(true);
    // Without generals in the setup, nobody rides.
    expect(generalsOf(createWorld(setup(1, null)))).toHaveLength(0);
  });

  it('the result lists the generals fielded and struck down, never the guard as a unit', () => {
    const w = createWorld(setup(3));
    for (let i = 0; i < 200; i++) step(w, []);
    const g = generalsOf(w)[0];
    g.strength = 0; g.alive = false; // cut down
    const r = toStrategicResult(w);
    expect(r.report.tactical.generalsFielded).toEqual(['c1']);
    expect(r.report.tactical.generalsStruck).toEqual(['c1']);
    expect(r.attackerUnits.some((u) => u.id === 'gen_c1')).toBe(false);
  });

  it('a whole battle with a general is deterministic and ends', () => {
    const a = runHeadless(setup(5)); const b = runHeadless(setup(5));
    expect(a.hash).toBe(b.hash);
    expect(['attacker', 'defender', 'stalemate']).toContain(a.result.outcome);
  });

  it('the sanitizer keeps only the battle\'s own commanders', () => {
    const state = { units: { a0: { id: 'a0', strength: 1000, commanderId: 'c1' }, d0: { id: 'd0', strength: 1000 } } };
    const pb = { attackerUnitIds: ['a0'], defenderUnitIds: ['d0'] };
    const safe = sanitizeTacticalResult(state, pb, { outcome: 'defender', attackerUnits: [{ id: 'a0', strength: 400 }], defenderUnits: [{ id: 'd0', strength: 900 }], report: { tactical: { generalsFielded: ['c1', 'zz'], generalsStruck: ['c1', 'zz'] } } });
    expect(safe.report.tactical.generalsFielded).toEqual(['c1']);
    expect(safe.report.tactical.generalsStruck).toEqual(['c1']);
  });
});

describe('one death rule for Command and Auto', () => {
  const hired = { c1: { id: 'c1', name: 'Hannibal', assignedUnitId: 'a0' } };
  // A turn on which the roll for c1 falls, and one on which it does not (the same roll both modes use).
  const turnFor = (key, falls) => { for (let t = 1; t < 500; t++) if ((hashRoll(`${key}|${t}`) < COMMANDER_FALL_CHANCE) === falls) return t; return null; };

  it('Command: a general whose guard was cut down falls on the 25% roll; one whose guard rode off lives', () => {
    const t = turnFor('gen_c1', true);
    expect(resolveCommanderCasualties(hired, [], t, ['c1']).fallen).toEqual(['Hannibal']);
    // The guard rode off: even with the unit destroyed, the general lives, unassigned.
    const lives = resolveCommanderCasualties(hired, [{ id: 'a0', commanderId: 'c1' }], t, []);
    expect(lives.fallen).toEqual([]);
    expect(lives.hiredCommanders.c1.assignedUnitId).toBeNull();
    // Struck but spared by the roll, with its unit alive: still in command.
    const spared = resolveCommanderCasualties(hired, [], turnFor('gen_c1', false), ['c1']);
    expect(spared.hiredCommanders.c1.assignedUnitId).toBe('a0');
  });

  it('Auto: the general of a destroyed unit is at risk, on the same 25% roll', () => {
    const t = turnFor('a0', true);
    expect(resolveCommanderCasualties(hired, [{ id: 'a0', commanderId: 'c1' }], t).fallen).toEqual(['Hannibal']);
    const t2 = turnFor('a0', false);
    expect(resolveCommanderCasualties(hired, [{ id: 'a0', commanderId: 'c1' }], t2).hiredCommanders.c1.assignedUnitId).toBeNull();
  });
});

describe('the general through the reducer (Command)', () => {
  it('the player\'s general rides on the field of a commanded battle and its fate follows the shared rule', () => {
    const tiles = getTiles();
    const IN = getNationCapital('in'); const PK = getNationCapital('pk');
    const s0 = syncWorldRegistry(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
    const city = s0.regions[PK];
    const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1)[0];
    const u = (id, regionId, extra) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
    const s = {
      ...s0, resources: { ...s0.resources, mil: 100, gold: 1000 },
      units: { a0: u('a0', IN, { tile: ring, strength: 300, commanderId: 'c1' }), g1: u('g1', PK, { ownerId: 'pk', tile: city.tile }), g2: u('g2', PK, { ownerId: 'pk', tile: city.tile }) },
      hiredCommanders: { c1: { id: 'c1', name: 'Ashoka', personality: 'aggressive', assignedUnitId: 'a0' } },
      wars: [...s0.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: s0.year, battleScore: 0 }],
      nations: { ...s0.nations, in: { ...s0.nations.in, isAtWar: true }, pk: { ...s0.nations.pk, isAtWar: true } },
      regions: { ...s0.regions, [PK]: { ...city, siege: { hp: 100, maxHp: 200, by: 'in', startedTurn: 1, encircled: false, starving: 0 } } },
      pendingDefenses: []
    };
    const q = aiSally(s, 'pk', createRng(5));
    const def = q.pendingDefenses[0];
    const began = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    const w = createWorld({ ...setup, controllers: ['ai', 'ai'] });
    expect(generalsOf(w).map((g) => [g.isGeneral, g.side])).toEqual([['c1', 1]]);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    expect(result.report.tactical.generalsFielded).toEqual(['c1']);
    const after = gameReducer(began, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: began.pendingBattle.id, result } });
    const struck = result.report.tactical.generalsStruck.includes('c1');
    const falls = struck && hashRoll(`gen_c1|${q.turnNumber}`) < COMMANDER_FALL_CHANCE;
    expect(!!after.hiredCommanders.c1).toBe(!falls);
  }, 120000);
});
