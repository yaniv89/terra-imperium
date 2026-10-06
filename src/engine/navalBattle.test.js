// src/engine/navalBattle.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { HISTORICAL_EVENTS } from '../data/events';
import { portWaters, seaPassable } from './fleets';
import { validateFleetAttack, enemyFleetsAt, getFleetBattleContext, AI_FLEET_ATTACK_RATIO } from './navalBattle';
import { armySheetModel, stackOn } from '../components/map/armySheetModel';
import { processAINavalOperations } from './aiOperations';
import { resolveQueuedAuto } from './battleQueue';
import { assertGameState } from './stateAudit';
import { getCombatWidth } from '../data/combatWidth';

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 })); return { ...s, units: {}, resources: { ...s.resources, mil: 100, gold: 1000 } }; })();
const FR = getNationCapital('fr'); const GB = getNationCapital('gb');
const fleet = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'naval', classId: 'naval', navalLine: 'warship', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, embarkedOn: null, promotions: [], xp: 0, ...extra });
const army = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s) => ({ ...s, wars: [...s.wars, { id: 'w-sea', aggressor: 'fr', enemy: 'gb', active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, fr: { ...s.nations.fr, isAtWar: true }, gb: { ...s.nations.gb, isAtWar: true } } });
// Two neighbouring sea tiles off the French port: ours and theirs.
const [ours, theirs] = (() => {
  const waters = portWaters(S, tiles, FR);
  for (const w of waters) { const o = tiles.neighbors[w].find((n) => tiles.land[n] !== 1 && seaPassable(tiles, n, 'bronze')); if (o != null) return [w, o]; }
  throw new Error('no sea pair off the port');
})();

describe('fleet against fleet (plan D5b)', () => {
  it('needs an enemy fleet at war on a neighbouring sea tile and a fleet with a move left', () => {
    const peace = withUnits(S, [fleet('f', FR, { tile: ours }), fleet('e', GB, { ownerId: 'gb', tile: theirs })]);
    expect(enemyFleetsAt(peace, theirs)).toEqual([]);
    expect(validateFleetAttack(peace, ours, theirs).reason).toBe('no_enemy');
    const war = atWar(peace);
    const v = validateFleetAttack(war, ours, theirs);
    expect(v.ok, v.reason).toBe(true);
    expect(v.attackerUnits.map((u) => u.id)).toEqual(['f']);
    expect(v.defenderUnits.map((u) => u.id)).toEqual(['e']);
    expect(validateFleetAttack(war, ours, S.regions[FR].tile).reason).toBe('bad_target');
    expect(validateFleetAttack(war, S.regions[GB].tile, theirs).reason).toBe('no_units');
    expect(validateFleetAttack({ ...war, units: { ...war.units, f: { ...war.units.f, movesLeft: 0 } } }, ours, theirs).reason).toBe('no_moves');
    const ctx = getFleetBattleContext(war, v);
    expect(ctx.terrain).toBe('sea'); expect(ctx.battleType).toBe('naval');
    expect(getCombatWidth('sea')).toBe(5);
  });

  it('ATTACK_FLEET sinks or scatters a weak enemy, takes its cargo down, spends the moves and scores the war', () => {
    const war = atWar(withUnits(S, [fleet('f1', FR, { tile: ours }), fleet('f2', FR, { tile: ours }), fleet('f3', FR, { tile: ours }), fleet('e', GB, { ownerId: 'gb', tile: theirs, strength: 150, maxStrength: 1000 }), army('c', GB, { ownerId: 'gb', tile: theirs, embarkedOn: 'e' })]));
    const next = gameReducer(war, { type: ActionTypes.ATTACK_FLEET, payload: { fromTile: ours, tile: theirs } });
    expect(next).not.toBe(war);
    const report = next.lastBattleReport || next.battleReports?.[0];
    expect(report?.kind).toBe('naval');
    expect(report.outcome).toBe('attacker');
    expect(next.wars.find((w) => w.id === 'w-sea').battleScore).toBeGreaterThan(0);
    ['f1', 'f2', 'f3'].forEach((id) => { if (next.units[id]) expect(next.units[id].movesLeft).toBe(0); });
    const e = next.units.e;
    if (e) { expect(e.tile).not.toBe(theirs); expect(tiles.land[e.tile]).not.toBe(1); expect(next.units.c?.tile).toBe(e.tile); } // scattered one tile with its cargo
    else expect(next.units.c).toBeUndefined(); // sunk with everything aboard
    expect(next.world.tileState[theirs].battle.outcome).toBe('attacker');
    expect(next.resources.mil).toBe(war.resources.mil - 2);
    expect(next.logs.at(-1).message).toMatch(/Your fleet beat/);
    assertGameState(next);
    expect(gameReducer(next, { type: ActionTypes.ATTACK_FLEET, payload: { fromTile: ours, tile: theirs } }).units).toEqual(next.units); // no moves left
  });

  it('the army sheet on a sea tile shows the fleet, its cargo and the enemy fleet beside it as a target', () => {
    const war = atWar(withUnits(S, [fleet('f', FR, { tile: ours }), army('a', FR, { tile: ours, embarkedOn: 'f' }), fleet('e', GB, { ownerId: 'gb', tile: theirs })]));
    expect(stackOn(war, ours).map((u) => u.id)).toEqual(['f']);
    const m = armySheetModel(war, ours);
    expect(m.naval).toBe(true);
    expect(m.groups[0].units[0].cargo).toBe(1);
    expect(m.targets).toEqual([expect.objectContaining({ kind: 'fleet', tile: theirs, ok: true, strength: 1000 })]);
    expect(m.pillage).toBeNull(); expect(m.siege).toBeNull();
  });

  it('an AI fleet attacks a weaker enemy fleet beside it', () => {
    const war = atWar(withUnits(S, [fleet('f', FR, { tile: ours, strength: 200, maxStrength: 1000 }), fleet('e1', GB, { ownerId: 'gb', tile: theirs }), fleet('e2', GB, { ownerId: 'gb', tile: theirs })]));
    expect(AI_FLEET_ATTACK_RATIO).toBeGreaterThan(1);
    const next = processAINavalOperations({ ...war, nations: { ...war.nations, gb: { ...war.nations.gb, economy: { ...(war.nations.gb.economy || {}), gold: 1000, mil: 50 } } } });
    // Against the player's fleet the battle waits in the queue for Command or Auto (battleQueue.js).
    expect(next.pendingDefenses?.[0]).toMatchObject({ kind: 'naval', aggressorId: 'gb', defenderUnitIds: ['f'] });
    const fought = resolveQueuedAuto(next, next.pendingDefenses[0].id);
    const f = fought.units.f;
    expect(!f || f.strength < 200 || f.tile !== ours).toBe(true);
    expect((fought.battleReports || []).some((b) => b.kind === 'naval' && b.playerSide === 'defender')).toBe(true);
  });
});
