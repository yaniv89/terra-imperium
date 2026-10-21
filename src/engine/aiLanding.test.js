// Phase R3 step 2: an AI landing on the player's coast, and the player's fleets intercepting it,
// wait in the battle queue for Command or Auto (src/engine/aiLanding.js; master plan 6.1, 6.10).
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { peoplesWorld, cloneWorld } from './testWorld';
import { ActionTypes } from '../data/types';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { processAINavalOperations } from './aiOperations';
import { resolveTurn } from './resolveTurn';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { resolveQueuedAuto, queuedBattleView, nextQueuedBattle } from './battleQueue';
import { isUnitInBattle } from './invasion';

// An island people (AI, at war with the player's coastal people) carries an army to a coastal city of the defender.
// Two coastal peoples of the small world that reach each other by sea: the attacker 'brigantes', the defender
// 'ahhiyawa' (the player unless `def` names another).
const fixture = ({ player = 'ahhiyawa', def = player, frenchFleet = 0, guard = true } = {}) => {
  const A = 'brigantes'; const D = def;
  const s = cloneWorld(peoplesWorld({ seed: 7, player }));
  s.techAgeId = 'modern';
  const port = Object.keys(s.regions).find((r) => s.regions[r].owner === A && isCoastal(r));
  const target = Object.keys(s.regions).find((r) => s.regions[r].owner === D && isCoastal(r) && isReachableBySea(port, r, s.techAgeId));
  if (!port || !target) throw new Error('fixture: the two coastal peoples do not reach each other by sea');
  s.wars = [{ id: 'island', aggressor: A, enemy: D, active: true, startYear: s.year, battleScore: 0 }];
  s.nations[A] = { ...s.nations[A], isAtWar: true, economy: { gold: 1000, hr: 1000, mil: 100, adm: 100 }, tech: { ageId: 'modern', researched: [] } };
  s.nations[D] = { ...s.nations[D], isAtWar: true, ...(player !== D ? { economy: { gold: 1000, hr: 1000, mil: 100, adm: 100 } } : {}) };
  const land = (id, owner, regionId, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [], xp: 0, ...extra });
  s.units = {
    fleet: { id: 'fleet', ownerId: A, regionId: port, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, promotions: [] },
    army: land('army', A, port), army2: land('army2', A, port),
    ...(guard ? { guard: land('guard', D, target) } : {})
  };
  for (let i = 0; i < frenchFleet; i++) s.units[`ff${i}`] = { id: `ff${i}`, ownerId: D, regionId: target, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [] };
  s.pendingDefenses = [];
  return { s: { ...s, battleSettings: { autoDefend: false } }, port, target, A, D };
};

describe('an AI landing on the player\'s coast is queued', () => {
  it('waits for Command or Auto, paid and moved, and pauses the turn', () => {
    const { s, target, A } = fixture();
    const q = processAINavalOperations(s);
    expect(q.pendingDefenses.map((d) => d.kind)).toEqual(['landing']);
    const def = q.pendingDefenses[0];
    expect(def).toMatchObject({ aggressorId: A, regionId: target, warId: 'island', navalUnitId: 'fleet' });
    expect(def.attackerUnitIds.sort()).toEqual(['army', 'army2']);
    expect(def.defenderUnitIds).toEqual(['guard']);
    expect(q.units.fleet.movesLeft).toBe(0);
    expect(q.units.army.embarkedOn).toBe('fleet');
    expect(isUnitInBattle(q, 'fleet')).toBe(true);
    expect(isUnitInBattle(q, 'guard')).toBe(true);
    expect(resolveTurn(q)).toBe(q);
    const view = queuedBattleView(q, def, 6);
    expect(view.name).toMatch(/^Landing at /);
    expect(view.attackerUnits).toHaveLength(2);
  });

  it('the player\'s fleets intercept first; a sunk transport takes its army down and the landing never comes', () => {
    const { s } = fixture({ frenchFleet: 3 });
    const q = processAINavalOperations(s);
    expect(q.pendingDefenses.map((d) => d.kind)).toEqual(['intercept', 'landing']);
    expect(nextQueuedBattle(q).kind).toBe('intercept');
    const ic = q.pendingDefenses[0];
    const after = gameReducer(q, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: ic.id } });
    expect(after.appliedBattleIds).toContain(ic.id);
    if (!after.units.fleet) {
      expect(after.units.army).toBeUndefined();
      expect(after.pendingDefenses).toHaveLength(0);
    } else expect(after.pendingDefenses.map((d) => d.kind)).toEqual(['landing']);
    expect(resolveQueuedAuto(after, ic.id)).toBe(after); // exactly once
  });

  it('Auto: the landing through the outcome service under the record\'s id, reported from the player\'s side', () => {
    const { s, target, A, D } = fixture();
    const q = processAINavalOperations(s);
    const def = q.pendingDefenses[0];
    const done = gameReducer(q, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(done.pendingDefenses).toHaveLength(0);
    expect(done.appliedBattleIds).toContain(def.id);
    expect(done.battleReports[0]).toMatchObject({ attackerNationId: A, defenderNationId: D, playerSide: 'defender' });
    // Taken: the army is ashore; repelled: back aboard (or dead).
    if (done.regions[target].owner === A) expect(done.units.army?.embarkedOn ?? null).toBe(null);
    else if (done.units.army) expect(done.units.army.embarkedOn).toBe('fleet');
  });

  it('Command: the player defends the beach in the real-time landing; the interception is a real sea battle', () => {
    const { s, A } = fixture({ frenchFleet: 1 });
    const q = processAINavalOperations(s);
    const [ic, ld] = q.pendingDefenses;
    const sea = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: ic.id } });
    expect(sea.pendingBattle).toMatchObject({ kind: 'intercept', playerSide: 'defender', attackerNationId: A, defenseId: ic.id });
    const seaSetup = buildInvasionSetup(sea, sea.pendingBattle);
    expect(seaSetup.battleType).toBe('naval');
    expect(seaSetup.controllers).toEqual(['ai', 'player']);
    // The transport wins the sea (the player's fleet withdraws): the landing comes next.
    const won = gameReducer(sea, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: sea.pendingBattle.id, result: { outcome: 'attacker', attackerUnits: [{ id: 'fleet', strength: 800 }], defenderUnits: [{ id: 'ff0', strength: 300 }], report: {} } } });
    expect(won.pendingBattle).toBeNull();
    expect(won.appliedBattleIds).toContain(ic.id);
    expect(won.pendingDefenses.map((d) => d.id)).toEqual([ld.id]);
    const beach = gameReducer(won, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: ld.id } });
    expect(beach.pendingBattle).toMatchObject({ kind: 'amphibious', playerSide: 'defender', attackerNationId: A, defenseId: ld.id });
    const setup = buildInvasionSetup(beach, beach.pendingBattle);
    expect(setup.controllers).toEqual(['ai', 'player']);
    expect(setup.sides[0].nationId).toBe(A);
    expect(['landing', 'assault', 'field']).toContain(setup.battleType);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const resolved = gameReducer(beach, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: beach.pendingBattle.id, result } });
    expect(resolved.pendingBattle).toBeNull();
    expect(resolved.pendingDefenses).toHaveLength(0);
    expect(resolved.appliedBattleIds).toContain(ld.id);
    expect(resolved.battleReports[0]).toMatchObject({ commanded: true, playerSide: 'defender' });
  }, 120000);

  it('AI against AI is still fought at once', () => {
    const { s, target } = fixture({ player: 'akkad', def: 'ahhiyawa' });
    const next = processAINavalOperations(s);
    expect(next.pendingDefenses || []).toHaveLength(0);
    expect(next.units.fleet.movesLeft).toBe(0);
    expect(next.units.army.lastBattleTurn ?? next.regions[target].owner).toBeTruthy();
  });
});
