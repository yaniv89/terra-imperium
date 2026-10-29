// Lead decision Q1 (29 Oct, lane odds-truth): Auto fights with the same troops standing by as a
// commanded city battle, so the card, Auto and the result read one force count (civ-veteran 297, 314,
// 316: Zafar's scouts said 14,900 and "Likely win", the battle met 44,900, the result said "Auto wins 100%").
import { describe, expect, it } from 'vitest';
import { getNeighborIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { ActionTypes } from '../data/types';
import { atGates, peoplesWorld, rivalOf, withBorder } from './testWorld';
import { standbyFor, reinforcementSources } from './battleInputs';
import { resolveAutoBattle, withStandby } from './autoBattle';
import { estimateInvasionOdds } from './battleOdds';
import { gameReducer } from './gameReducer';
import { createRng } from '../utils/rng';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs } from './invasion';

const WORLD = peoplesWorld({ seed: 7 });
const ME = WORLD.playerNationId;
const FOE = rivalOf(WORLD, 0);
const u = (id, ownerId, regionId, tile, strength) => ({ id, ownerId, regionId, tile, domain: 'land', classId: 'infantry', strength, maxStrength: Math.max(1000, strength), morale: 100, movesLeft: 1 });

const setup = () => {
  const state = withBorder(WORLD, ME, FOE);
  const from = Object.keys(state.regions).find((id) => state.regions[id].owner === ME && getNeighborIds(id).some((n) => state.regions[n]?.owner === FOE));
  const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === FOE);
  const s = atGates({
    ...state,
    wars: [{ id: 'w', aggressor: ME, enemy: FOE, active: true, score: 0 }],
    resources: { ...state.resources, gold: 10000, mil: 1000 },
    units: { a: u('a', ME, from, null, 1000), d: u('d', FOE, target, state.regions[target].tile, 300) }
  }, from, target);
  // An enemy stack beside the city, not in it: a commanded assault would call it in.
  const near = getTiles().neighbors[s.regions[target].tile].find((x) => x !== s.units.a.tile && !Object.values(s.regions).some((c) => c.tile === x));
  return { s: { ...s, units: { ...s.units, r: u('r', FOE, 'elsewhere', near, 2000) } }, from, target };
};

describe('Auto fights with the troops standing by (Q1)', () => {
  it('are exactly the ones a commanded assault calls in', () => {
    const { s, from, target } = setup();
    const commanded = reinforcementSources(s, target, FOE, ME).flatMap((src) => src.unitIds);
    const [att, def] = standbyFor(s, { kind: 'invasion', cityId: target, fromRegionId: from, attackerUnits: [s.units.a], defenderUnits: [s.units.d] });
    expect(def.map((x) => x.id)).toEqual(commanded);
    expect(def.map((x) => x.id)).toContain('r');
    expect(att).toEqual([]);
  });

  it('never a unit aboard a ship, a settler or one already in another battle (review)', () => {
    const { s, from, target } = setup();
    const r = s.units.r;
    const st = { ...s, units: { ...s.units, b: { ...r, id: 'b', embarkedOn: 'ship' }, c: { ...r, id: 'c', classId: 'settler' }, e: { ...r, id: 'e' } }, pendingDefenses: [{ id: 'x', defenderUnitIds: ['e'], attackerUnitIds: [] }] };
    const [, def] = standbyFor(st, { kind: 'invasion', cityId: target, fromRegionId: from, attackerUnits: [s.units.a], defenderUnits: [s.units.d] });
    expect(def.map((x) => x.id)).toEqual(['r']);
  });

  it('a landing on the player\'s city brings the player\'s standby, as the commanded landing does', () => {
    const { s, target } = setup();
    const mine = { ...s, regions: { ...s.regions, [target]: { ...s.regions[target], owner: ME } }, units: { ...s.units, r: { ...s.units.r, ownerId: ME } } };
    const [, def] = standbyFor(mine, { kind: 'landing', cityId: target, attackerUnits: [{ ...s.units.a, ownerId: FOE }], defenderUnits: [] });
    expect(def.map((x) => x.id)).toContain('r');
  });

  it('AI against AI and field battles take none', () => {
    const { s, target } = setup();
    const ai = { ...s, playerNationId: 'nobody' };
    expect(standbyFor(ai, { kind: 'invasion', cityId: target, attackerUnits: [s.units.a], defenderUnits: [s.units.d] })).toEqual([[], []]);
    expect(standbyFor(s, { kind: 'field', cityId: target, attackerUnits: [s.units.a], defenderUnits: [s.units.d] })).toEqual([[], []]);
  });

  it('the card, Auto and its result count the same defenders', { timeout: 60000 }, () => {
    const { s, from, target } = setup();
    const odds = estimateInvasionOdds(s, from, target, 10);
    expect(odds.defenderStandby).toBe(2000);
    const v = validateInvasion(s, from, target);
    const ctx = getInvasionBattleContext(s, { targetRegionId: target, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
    const spec = { kind: 'invasion', cityId: target, fromRegionId: from };
    const fought = resolveAutoBattle(s, getResolveBattleArgs(v, ctx), spec, createRng(1));
    expect(fought.defenderUnits.map((x) => x.id)).toContain('r');
    const sum = (us) => us.reduce((n, x) => n + x.strength, 0);
    expect(sum(fought.inputs.defenderUnits)).toBe(odds.defenderStrength);
    expect(withStandby(s, getResolveBattleArgs(v, ctx), spec).defenderUnits.length).toBe(v.defenderUnits.length + 1);
  });

  it('on Auto the standby takes its losses where it stands; the city is not where it goes', { timeout: 60000 }, () => {
    const { s, from, target } = setup();
    const after = gameReducer({ ...s, rngSeed: 5 }, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: from, targetRegionId: target } });
    const r = after.units.r;
    if (r) {
      expect(r.regionId).toBe('elsewhere');
      expect(r.tile).toBe(s.units.r.tile);
      expect(r.strength).toBeLessThanOrEqual(2000);
    }
    const report = after.battleReports?.[0];
    expect(report).toBeTruthy();
  });
});
