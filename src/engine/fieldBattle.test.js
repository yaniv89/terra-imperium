// src/engine/fieldBattle.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { createRng } from '../utils/rng';
import { validateFieldAttack, getFieldBattleContext, applyFieldResult, enemyStackAt, RIVER_ATTACK_MULT, FORT_REDUCTION, FORTIFY_REDUCTION, isFortified } from './fieldBattle';
import { estimateFieldOdds } from './battleOdds';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { aiSally } from './aiOperations';
import { assertGameState } from './stateAudit';

const tiles = getTiles();
const S = (() => { const s = createInitialState({ playerNationId: 'in', rngSeed: 3 }); return { ...s, units: {}, resources: { ...s.resources, mil: 100, gold: 1000 } }; })();
const IN = getNationCapital('in'); const PK = getNationCapital('pk');
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s) => ({ ...s, wars: [...s.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, in: { ...s.nations.in, isAtWar: true }, pk: { ...s.nations.pk, isAtWar: true } } });
// Two adjacent free land tiles near Delhi: ours and theirs.
const pair = (() => {
  const seen = new Set([S.regions[IN].tile]); let f = [S.regions[IN].tile];
  for (let d = 0; d < 8; d++) {
    const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n.sort((a, b) => a - b);
    for (const t of f) { if (tiles.land[t] !== 1 || S.world.tileOwner[t]) continue; const o = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && !S.world.tileOwner[x] && x !== t); if (o != null) return [t, o]; }
  }
  throw new Error('no free pair');
})();
const [ours, theirs] = pair;

describe('field attacks', () => {
  it('needs an enemy stack on an adjacent tile at war, never a city, and only units with a move left', () => {
    const peace = withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs })]);
    expect(enemyStackAt(peace, theirs)).toEqual([]);
    expect(validateFieldAttack(peace, IN, theirs).reason).toBe('no_enemy');
    const war = atWar(peace);
    const v = validateFieldAttack(war, IN, theirs);
    expect(v.ok, v.reason).toBe(true);
    expect(v.attackerUnits.map((u) => u.id)).toEqual(['a']);
    expect(v.defenderUnits.map((u) => u.id)).toEqual(['e']);
    expect(validateFieldAttack(war, IN, S.regions[PK].tile).reason).toBe('is_city');
    const spent = { ...war, units: { ...war.units, a: { ...war.units.a, movesLeft: 0 } } };
    expect(validateFieldAttack(spent, IN, theirs).reason).toBe('no_moves');
    const far = { ...war, units: { ...war.units, a: { ...war.units.a, tile: S.regions[IN].tile } } };
    expect(validateFieldAttack(far, IN, theirs).reason).toBe('no_units');
  });

  it('a river between the tiles and a fort on the target change the odds', () => {
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs })]));
    const v = validateFieldAttack(war, IN, theirs);
    const plain = getFieldBattleContext(war, v);
    expect(plain.attackerPenaltyMultiplier).toBe(1);
    expect(tiles.riverBetween(ours, theirs) ? plain.battleType === 'river' : plain.battleType !== 'river').toBe(true); // the type carries the river odds (battleType.js)
    expect(RIVER_ATTACK_MULT).toBeLessThan(1);
    expect(plain.defenderDamageReductionMultiplier).toBe(1);
    const fort = { ...war, world: { ...war.world, tileState: { ...war.world.tileState, [theirs]: { improvement: 'fort' } } } };
    expect(getFieldBattleContext(fort, validateFieldAttack(fort, IN, theirs)).defenderDamageReductionMultiplier).toBe(FORT_REDUCTION);
    const odds = estimateFieldOdds(war, IN, theirs, 40);
    expect(odds.attacker + odds.defender + odds.stalemate).toBeCloseTo(1, 5);
    expect(odds.field).toBe(true);
  });

  it('the loser retreats a tile towards its base, or dies with no way out; the war score moves', () => {
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('b', IN, { tile: ours, classId: 'cavalry' }), unit('c', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs, strength: 300, maxStrength: 1000 })]));
    const v = validateFieldAttack(war, IN, theirs);
    const ctx = getFieldBattleContext(war, v);
    const win = { outcome: 'attacker', attackerUnits: v.attackerUnits.map((u) => ({ ...u, strength: 900 })), defenderUnits: [{ ...v.defenderUnits[0], strength: 100, routed: true }], report: { deployedAttackerIds: ['a'], deployedDefenderIds: ['e'], outcome: 'attacker' } };
    const after = applyFieldResult(war, v, win, { rngSeed: 1 });
    expect(after.units.e.tile).not.toBe(theirs);
    expect(tiles.neighbors[theirs]).toContain(after.units.e.tile);
    expect(after.units.e.regionId).toBe(PK);
    expect(after.units.a.movesLeft).toBe(0);
    expect(after.units.a.xp).toBeGreaterThan(0);
    expect(after.wars.find((w) => w.id === 'w-f').battleScore).toBeGreaterThan(0);
    expect(after.battleReports[0].kind).toBe('field');
    expect(after.logs[after.logs.length - 1].message).toMatch(/beat/);
    assertGameState(after);
    // Beaten with every neighbour closed: destroyed.
    const ring = tiles.neighbors[theirs].filter((t) => tiles.land[t] === 1 && t !== ours).map((t, i) => unit(`r${i}`, IN, { tile: t }));
    const boxed = atWar(withUnits(S, [unit('a', IN, { tile: ours }), ...ring, unit('e', PK, { ownerId: 'pk', tile: theirs })]));
    const v2 = validateFieldAttack(boxed, IN, theirs);
    const win2 = { outcome: 'attacker', attackerUnits: v2.attackerUnits, defenderUnits: [{ ...v2.defenderUnits[0], strength: 100 }], report: { deployedAttackerIds: [], deployedDefenderIds: [], outcome: 'attacker' } };
    const gone = applyFieldResult(boxed, v2, win2, { rngSeed: 1 });
    if (tiles.neighbors[theirs].every((t) => tiles.land[t] !== 1 || t === ours || ring.some((r) => r.tile === t))) {
      expect(gone.units.e).toBeUndefined();
      expect(gone.battleReports[0].sides.defender.find((u) => u.id === 'e').fate).toBe('runDown'); // the report: caught with no way back
    }
    // A lost attack (master plan 6.9): the defender holds its tile; the attackers, who withdrew,
    // step back one tile away from it (a unit still on the field would be destroyed).
    const lose = { outcome: 'defender', attackerUnits: v.attackerUnits.map((u) => ({ ...u, strength: 500 })), defenderUnits: v.defenderUnits, report: { deployedAttackerIds: [], deployedDefenderIds: [], outcome: 'defender' } };
    const held = applyFieldResult(war, v, lose, { rngSeed: 1 });
    expect(held.units.e.tile).toBe(theirs);
    expect(held.units.a.tile).not.toBe(theirs);
    expect([ours, ...tiles.neighbors[ours]]).toContain(held.units.a.tile);
    expect(held.battleReports[0].sides.attacker.find((u) => u.id === 'a').fate).toBe('withdrew');
    expect(held.battleReports[0].sides.defender.find((u) => u.id === 'e').fate).toBe('held');
    const caught = applyFieldResult(war, v, { ...lose, attackerUnits: lose.attackerUnits.map((u) => ({ ...u, disposition: 'field' })) }, { rngSeed: 1 });
    expect(caught.units.a).toBeUndefined();
    expect(caught.battleReports[0].sides.attacker.find((u) => u.id === 'a')).toMatchObject({ fate: 'runDown', before: 1000, after: 500 });
    expect(ctx.isDefended).toBe(true);
  });

  it('ATTACK_ARMY resolves through the reducer and the commanded battle builds from the tile', () => {
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('b', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs, strength: 200, maxStrength: 1000 })]));
    const auto = gameReducer(war, { type: ActionTypes.ATTACK_ARMY, payload: { fromRegionId: IN, tile: theirs } });
    expect(auto.resources.mil).toBe(war.resources.mil - 2);
    expect(auto.battleReports[0].kind).toBe('field');
    assertGameState(auto);
    const began = gameReducer(war, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: IN, tile: theirs } });
    expect(began.pendingBattle.kind).toBe('field');
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.tile).toBe(theirs);
    expect(setup.structures.find((s) => s.kind === 'keep').damage).toBe(0);
    const abandoned = gameReducer(began, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(abandoned.pendingBattle).toBeNull();
    expect(abandoned.battleReports[0].kind).toBe('field');
    const resolved = gameReducer(began, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: began.pendingBattle.id, result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [{ id: 'e', strength: 0 }], report: {} } } });
    expect(resolved.pendingBattle).toBeNull();
    expect(resolved.units.e).toBeUndefined();
  });

  it('an AI garrison sallies against besiegers it outweighs', () => {
    const city = S.regions[PK];
    const ring = tiles.neighbors[city.tile].find((t) => tiles.land[t] === 1);
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ring, strength: 200, maxStrength: 1000 }), unit('g1', PK, { ownerId: 'pk', tile: city.tile }), unit('g2', PK, { ownerId: 'pk', tile: city.tile })]));
    const besieged = { ...war, regions: { ...war.regions, [PK]: { ...city, siege: { hp: 100, maxHp: 200, by: 'in', startedTurn: 1, encircled: false, starving: 0 } } } };
    const after = aiSally(besieged, 'pk', createRng(5));
    // Against the player, the sally waits in the battle queue for Command or Auto (battleQueue.js).
    expect(after.pendingDefenses?.[0]?.kind).toBe('field');
    expect(after.units.g1.movesLeft).toBe(0);
    const outweighed = { ...besieged, units: { ...besieged.units, a: { ...besieged.units.a, strength: 1000 }, a2: { ...besieged.units.a, id: 'a2', strength: 1000 } } };
    const nope = aiSally(outweighed, 'pk', createRng(5));
    expect(nope.battleReports?.length || 0).toBe(0);
    expect(nope.pendingDefenses?.length || 0).toBe(0);
  });
});

describe('fortify (plans/playtest-1.md P2.3)', () => {
  it('a stack that held its tile a full turn takes less damage; a march or a move clears it', () => {
    const turn = 10;
    expect(isFortified({ heldSince: 9 }, turn)).toBe(true);
    expect(isFortified({ heldSince: 10 }, turn)).toBe(false);
    expect(isFortified({ heldSince: 5, route: [1, 2] }, turn)).toBe(false);
    expect(isFortified({}, turn)).toBe(false);
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs, heldSince: S.turnNumber - 2 })]));
    const v = validateFieldAttack(war, IN, theirs);
    expect(getFieldBattleContext(war, v).defenderDamageReductionMultiplier).toBeCloseTo(FORTIFY_REDUCTION, 5);
    const fresh = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs, heldSince: S.turnNumber })]));
    expect(getFieldBattleContext(fresh, validateFieldAttack(fresh, IN, theirs)).defenderDamageReductionMultiplier).toBe(1);
  });
});
