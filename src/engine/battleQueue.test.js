// src/engine/battleQueue.test.js
// Command or Auto for every battle (master plan 6.1, decision 24): battles others start against
// the player wait in the queue, in movement order, each pausing the turn, and the queue waits for
// an open event or peace offer like resolveTurn does. AI against AI is always Auto.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { createRng } from '../utils/rng';
import { aiSally } from './aiOperations';
import { resolveTurn } from './resolveTurn';
import { syncWorldRegistry } from './world/registry';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { battleQueueBlocked, nextQueuedBattle, resolveQueuedAuto, drainAutoBattles, queuedBattleView, queuedKind } from './battleQueue';
import { isUnitInBattle } from './invasion';

const tiles = getTiles();
const IN = getNationCapital('in'); const PK = getNationCapital('pk');
const base = () => {
  const s = syncWorldRegistry(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
  return { ...s, units: {}, resources: { ...s.resources, mil: 100, gold: 1000 } };
};
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
// The player (India) besieges Pakistan's capital with a weak stack; Pakistan's garrison sallies.
const besieged = (rings = 1) => {
  const S = base();
  const city = S.regions[PK];
  const ringTiles = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1).slice(0, rings);
  const mine = ringTiles.map((t, i) => unit(`a${i}`, IN, { tile: t, strength: 200 }));
  const units = Object.fromEntries([...mine, unit('g1', PK, { ownerId: 'pk', tile: city.tile }), unit('g2', PK, { ownerId: 'pk', tile: city.tile })].map((u) => [u.id, u]));
  return {
    ...S, units,
    wars: [...S.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: S.year, battleScore: 0 }],
    nations: { ...S.nations, in: { ...S.nations.in, isAtWar: true }, pk: { ...S.nations.pk, isAtWar: true } },
    regions: { ...S.regions, [PK]: { ...city, siege: { hp: 100, maxHp: 200, by: 'in', startedTurn: 1, encircled: false, starving: 0 } } },
    pendingDefenses: []
  };
};

describe('the battle queue', () => {
  it('an AI attack on the player\'s army waits in the queue for Command or Auto; AI against AI is fought at once', () => {
    const s = besieged();
    const after = aiSally(s, 'pk', createRng(5));
    expect(after.pendingDefenses).toHaveLength(1);
    const def = after.pendingDefenses[0];
    expect(queuedKind(def)).toBe('field');
    expect(def.aggressorId).toBe('pk');
    expect(def.defenderUnitIds).toEqual(['a0']);
    expect(after.units.g1.movesLeft).toBe(0);
    expect(isUnitInBattle(after, 'a0')).toBe(true);
    expect(after.battleReports?.length || 0).toBe(0);
    // The turn waits for it.
    expect(resolveTurn(after)).toBe(after);
    expect(queuedBattleView(after, def, 8).name).toMatch(/^Battle of /);
    // AI against AI: the same sally against a third nation's besiegers is fought on Auto at once.
    const third = { ...s, units: { ...s.units, a0: { ...s.units.a0, ownerId: 'af' } }, wars: [...s.wars, { id: 'w-x', aggressor: 'af', enemy: 'pk', active: true, battleScore: 0 }], regions: { ...s.regions, [PK]: { ...s.regions[PK], siege: { ...s.regions[PK].siege, by: 'af' } } } };
    const ai = aiSally(third, 'pk', createRng(5));
    expect(ai.pendingDefenses).toHaveLength(0);
    expect(ai.units.g1.lastBattleTurn).toBe(s.turnNumber);
  });

  it('Auto fights it through the outcome service exactly once', () => {
    const after = aiSally(besieged(), 'pk', createRng(5));
    const def = after.pendingDefenses[0];
    const done = gameReducer(after, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(done.pendingDefenses).toHaveLength(0);
    expect(done.appliedBattleIds).toContain(def.id);
    expect(done.battleReports[0]).toMatchObject({ kind: 'field', attackerNationId: 'pk', defenderNationId: 'in', playerSide: 'defender' });
    // The record gone and the id remembered, the same battle cannot land twice.
    expect(resolveQueuedAuto(done, def.id)).toBe(done);
  });

  it('Command: the player defends the field battle the AI started, and its result lands once under the record\'s id', () => {
    const after = aiSally(besieged(), 'pk', createRng(5));
    const def = after.pendingDefenses[0];
    const began = gameReducer(after, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    expect(began.pendingBattle).toMatchObject({ kind: 'field', playerSide: 'defender', attackerNationId: 'pk', defenseId: def.id });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.controllers).toEqual(['ai', 'player']);
    expect(setup.sides[0].nationId).toBe('pk');
    const resolved = gameReducer(began, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: began.pendingBattle.id, result: { outcome: 'defender', attackerUnits: [{ id: 'g1', strength: 600, disposition: 'fled' }, { id: 'g2', strength: 500, disposition: 'fled' }], defenderUnits: [{ id: 'a0', strength: 150, disposition: 'field' }], report: {} } } });
    expect(resolved.pendingBattle).toBeNull();
    expect(resolved.pendingDefenses).toHaveLength(0);
    expect(resolved.appliedBattleIds).toContain(def.id);
    expect(resolved.units.a0.strength).toBe(150);
    // Abandoning instead is the same queued battle's Auto.
    const abandoned = gameReducer(began, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(abandoned.pendingDefenses).toHaveLength(0);
    expect(abandoned.appliedBattleIds).toContain(def.id);
  });

  it('several battles in one turn come in the order the armies moved, each pausing the turn', () => {
    const s = besieged(2);
    const one = aiSally(s, 'pk', createRng(5));
    // A second queued battle: another stack of the player, attacked the same turn.
    const def2 = { ...one.pendingDefenses[0], id: 'fd_second', defenderUnitIds: ['a1'], tile: s.units.a1.tile };
    const two = { ...one, pendingDefenses: [...one.pendingDefenses, def2] };
    expect(nextQueuedBattle(two).id).toBe(one.pendingDefenses[0].id);
    expect(resolveTurn(two)).toBe(two);
    const first = gameReducer(two, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: one.pendingDefenses[0].id } });
    expect(nextQueuedBattle(first)?.id).toBe('fd_second');
    expect(resolveTurn(first)).toBe(first);
    const all = gameReducer(two, { type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO });
    expect(all.pendingDefenses).toHaveLength(0);
  });

  it('waits while an event or a peace offer is open, like resolveTurn; autoDefend drains it once answered', () => {
    const queued = aiSally(besieged(), 'pk', createRng(5));
    const offer = { ...queued, pendingPeaceOffer: { warId: 'w-f', fromNationId: 'pk', terms: [] } };
    expect(battleQueueBlocked(offer)).toBe(true);
    expect(nextQueuedBattle(offer)).toBeNull();
    const refused = gameReducer(offer, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: queued.pendingDefenses[0].id } });
    expect(refused.pendingDefenses).toHaveLength(1);
    expect(gameReducer(offer, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: queued.pendingDefenses[0].id } }).pendingBattle || null).toBeNull();
    const auto = { ...offer, battleSettings: { autoDefend: true } };
    expect(drainAutoBattles(auto)).toBe(auto);
    const answered = { ...auto, pendingPeaceOffer: null };
    expect(drainAutoBattles(answered).pendingDefenses).toHaveLength(0);
    const event = { ...answered, activeEventId: 'some_event' };
    expect(drainAutoBattles(event)).toBe(event);
  });
});
