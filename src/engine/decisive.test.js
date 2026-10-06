// Phase R3 step 4, decision 33 (plans/MASTER-PLAN.md 6.9): field battles are decisive. A broken
// side runs for its edge and is pursued; the battle ends when the last loser is off the field, or
// after PURSUIT_SECONDS. The loser's units still on the field are destroyed, the ones that left by
// an exit survive and step back one tile, the winner's units gain XP. The same rule on Auto.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { createRng } from '../utils/rng';
import { aiSally } from './aiOperations';
import { syncWorldRegistry } from './world/registry';
import { buildInvasionSetup, buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { createWorld } from '../battle/sim/world';
import { step, PURSUIT_TICKS } from '../battle/sim/step';
import { toStrategicResult } from '../battle/sim/result';
import { runHeadless } from '../battle/sim/headless';
import { XP_WIN } from './battleOutcome';
import { autoFromInputs, AUTO_ESCAPE_CHANCE, AUTO_ESCAPE_PURSUED } from './autoBattle';

const tiles = getTiles();
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

describe('the pursuit on the battle map', () => {
  const setup = (seed) => buildSetupFromArmies({ regionId: `d-${seed}`, terrain: 'plains', seed, attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged', 'infantry']), defenderUnits: mk('d', ['infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: 'field' });

  it('a broken side is pursued: the battle ends when the last loser is off the field or after the pursuit', () => {
    const w = createWorld(setup(2));
    let pursuitAt = -1;
    while (!w.ended && w.tick < 20000) {
      step(w, []);
      if (pursuitAt < 0 && w.events.some((e) => e.type === 'pursuit')) pursuitAt = w.tick;
      w.events.length = 0;
    }
    expect(w.ended.outcome).toBe('attacker');
    expect(pursuitAt).toBeGreaterThan(0);
    expect(w.ended.tick - pursuitAt).toBeLessThanOrEqual(PURSUIT_TICKS);
    const result = toStrategicResult(w);
    const onField = result.defenderUnits.filter((u) => u.disposition === 'field');
    // Either everyone got out or died, or the pursuit ran out with some still on the field.
    if (w.ended.tick - pursuitAt < PURSUIT_TICKS - 1) expect(onField).toHaveLength(0);
    result.defenderUnits.forEach((u) => expect(['dead', 'fled', 'field']).toContain(u.disposition));
  });

  it('deterministic', () => {
    expect(runHeadless(setup(4)).hash).toBe(runHeadless(setup(4)).hash);
  });
});

// The battle queue's fixture: the player (India) besieges Pakistan's capital; Pakistan sallies.
const IN = getNationCapital('in'); const PK = getNationCapital('pk');
const besieged = () => {
  const s0 = syncWorldRegistry(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
  const S = { ...s0, units: {}, resources: { ...s0.resources, mil: 100, gold: 1000 } };
  const city = S.regions[PK];
  const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1)[0];
  const u = (id, regionId, extra) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
  const units = { a0: u('a0', IN, { tile: ring, strength: 300 }), a1: u('a1', IN, { tile: ring, strength: 300, classId: 'ranged' }), g1: u('g1', PK, { ownerId: 'pk', tile: city.tile }), g2: u('g2', PK, { ownerId: 'pk', tile: city.tile }), g3: u('g3', PK, { ownerId: 'pk', tile: city.tile, classId: 'cavalry' }) };
  return {
    ...S, units, ring,
    wars: [...S.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: S.year, battleScore: 0 }],
    nations: { ...S.nations, in: { ...S.nations.in, isAtWar: true }, pk: { ...S.nations.pk, isAtWar: true } },
    regions: { ...S.regions, [PK]: { ...city, siege: { hp: 100, maxHp: 200, by: 'in', startedTurn: 1, encircled: false, starving: 0 } } },
    pendingDefenses: []
  };
};

const checkDecisive = (before, after, ring) => {
  ['a0', 'a1'].forEach((id) => {
    const u = after.units[id];
    if (!u) return; // destroyed: dead, or still on the field when the battle ended
    expect(u.tile).not.toBe(ring); // got out by an exit: one tile back
    expect(tiles.neighbors[ring]).toContain(u.tile);
  });
  // The winner's units that fought gain XP.
  const winners = ['g1', 'g2', 'g3'].map((id) => after.units[id]).filter(Boolean);
  expect(winners.some((u) => (u.xp || 0) >= XP_WIN)).toBe(true);
};

describe('decisive field battles through the reducer, Command and Auto', () => {
  it('Command: the commanded result lands under decision 33', () => {
    const s = besieged();
    const q = aiSally(s, 'pk', createRng(5));
    const def = q.pendingDefenses[0];
    expect(def).toBeTruthy();
    const began = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const after = gameReducer(began, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: began.pendingBattle.id, result } });
    expect(after.pendingDefenses).toHaveLength(0);
    if (result.outcome === 'attacker') checkDecisive(s, after, s.ring);
  }, 120000);

  it('Auto: the same rule (routed losers escape AUTO_ESCAPE_CHANCE, less with cavalry pursuing)', () => {
    expect(AUTO_ESCAPE_PURSUED).toBeLessThan(AUTO_ESCAPE_CHANCE);
    const s = besieged();
    const q = aiSally(s, 'pk', createRng(5));
    const after = gameReducer(q, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: q.pendingDefenses[0].id } });
    const rep = after.battleReports[0];
    expect(rep.kind).toBe('field');
    if (rep.outcome === 'attacker') checkDecisive(s, after, s.ring);
  });

  it('on Auto a loser still unbroken at the end withdraws; one on the field is lost', () => {
    const ins = { attackerUnits: mk('a', ['infantry', 'cavalry', 'infantry', 'infantry']), defenderUnits: mk('d', ['infantry']), hpRatio: 1, economyInputs: { supply: [1, 1], development: [0, 0] }, housing: 0 };
    const r = autoFromInputs({ terrain: 'plains', battleType: 'field', attackerAgeId: 'bronze', defenderAgeId: 'bronze', generals: {} }, ins, 'field', createRng(9));
    const loser = r.outcome === 'attacker' ? r.defenderUnits : r.attackerUnits;
    loser.forEach((u) => expect(u.strength <= 0 ? 'dead' : u.routed ? ['fled', 'field'] : ['fled']).toContain(u.disposition));
  });
});
