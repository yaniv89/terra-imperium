// The capture card (decision 40, capture.js) and the occupation rules it leans on (I126 to I132).
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities } from './testWorld';
import { applyBattleOutcome, makeBattleOutcome } from './battleOutcome';
import { cityFell, pendingCapturesOf, captureOptions, resolveCapture, settleOpenCaptures, openCapture, CAPTURE_TRIBUTE_TURNS } from './capture';
import { conquerRegion, OCCUPATION_GRACE_TURNS, OCCUPATION_GRACE_FLOOR, CAPTURE_REPEAT_TURNS } from './conquest';
import { applyLoyalty, loyaltyForecast, loyaltyTarget, LOYALTY_OCCUPATION_PER_UNIT } from './loyalty';
import { turnBlockers } from './turnBlockers';
import { processSieges, BREACH_HOLD_TURNS } from './sieges';
import { isIndependentNation } from '../data/independents';
import { syncWorldRegistry } from './world/registry';
import { auditGameState } from './stateAudit';

const tiles = getTiles();

const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr') || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr');
  const near = addCity(first.state, 'fr', { near: target });
  const AGG = near.state.regions[target].owner;
  const grown = addCities(near.state, AGG, 3);
  return { state: grown.state, FR: first.cityId, T: target, AGG };
})();
const { FR, T, AGG } = WORLD;
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1
});
const armies = () => {
  const s = syncWorldRegistry(WORLD.state);
  return {
    ...s,
    nations: { ...s.nations, fr: { ...s.nations.fr, isAtWar: true }, [AGG]: { ...s.nations[AGG], isAtWar: true } },
    wars: [...s.wars, { id: 'war_t', aggressor: 'fr', enemy: AGG, active: true, startTurn: s.turnNumber, battleScore: 0 }],
    units: { a1: unit('a1', FR, 'fr'), a2: unit('a2', FR, 'fr', 'cavalry'), d1: unit('d1', T, AGG) }
  };
};
const outcomeOf = (s, outcome, { id = 'op1', attacker = 'fr', defender = AGG, kind = 'invasion', viewerId } = {}) => makeBattleOutcome({
  id, kind, mode: 'auto', warId: 'war_t', attackerNationId: attacker, defenderNationId: defender, viewerId, fromRegionId: FR, regionId: T, tile: s.regions[T].tile, isDefended: true
}, { outcome, attackerUnits: [{ ...s.units.a1, strength: 900 }, { ...s.units.a2, strength: 900 }], defenderUnits: [{ ...s.units.d1, strength: 500 }], report: {} });

describe('cityFell: the one reading of a city battle', () => {
  it('a won city battle with troops to hold it is a fall; ranged-only or a loss is not', () => {
    expect(cityFell({ outcome: 'attacker' })).toBe(true);
    expect(cityFell({ outcome: 'attacker' }, { occupier: false })).toBe(false);
    expect(cityFell({ outcome: 'defender' })).toBe(false);
    expect(cityFell({ outcome: 'defender' }, { fell: true })).toBe(true);
  });
});

describe('decision 40: a won city battle opens one capture card', () => {
  it('Auto: the city changes hands at once and the card waits, once, and blocks End Turn', () => {
    const s = armies();
    const won = applyBattleOutcome(s, outcomeOf(s, 'attacker'));
    expect(won.regions[T].owner).toBe('fr');
    expect(pendingCapturesOf(won)).toHaveLength(1);
    expect(pendingCapturesOf(won)[0]).toMatchObject({ cityId: T, by: 'fr', from: AGG, source: 'battle' });
    expect(turnBlockers(won).some((b) => b.kind === 'capture')).toBe(true);
    // The same operation again changes nothing (applyBattleOutcome is idempotent by id).
    expect(applyBattleOutcome(won, outcomeOf(won, 'attacker'))).toBe(won);
  });

  it('Command and Auto read the same: a commanded win opens the same card', () => {
    const s = armies();
    const o = { ...outcomeOf(s, 'attacker'), mode: 'command' };
    const won = applyBattleOutcome(s, o);
    expect(pendingCapturesOf(won)).toHaveLength(1);
  });

  it('a lost battle, a field battle and an AI winner open no card', () => {
    const s = armies();
    expect(pendingCapturesOf(applyBattleOutcome(s, outcomeOf(s, 'defender')))).toHaveLength(0);
    // An AI taking a city (the AI invasion runs as if the AI were the player, viewer = the real player).
    // Here 'fr' plays the AI attacker and AGG the real player watching.
    const ai = applyBattleOutcome(s, outcomeOf(s, 'attacker', { id: 'op9', viewerId: AGG }));
    expect(ai.regions[T].owner).toBe('fr');
    expect(ai.pendingCaptures || []).toHaveLength(0);
  });

  it('commits exactly once: a second answer finds nothing to do', () => {
    const s = applyBattleOutcome(armies(), outcomeOf(armies(), 'attacker'));
    const id = s.pendingCaptures[0].id;
    const kept = gameReducer(s, { type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: id, choice: 'conquer' } });
    expect(kept.pendingCaptures).toHaveLength(0);
    expect(kept.regions[T].owner).toBe('fr');
    const again = gameReducer(kept, { type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: id, choice: 'raze' } });
    expect(again.regions).toBe(kept.regions);
    expect(again.nations.fr.battleStats).toEqual(kept.nations.fr.battleStats);
  });

  it('raze burns the city; tributary and free are disabled with a reason in a world without independents', () => {
    const s = applyBattleOutcome(armies(), outcomeOf(armies(), 'attacker'));
    const cap = s.pendingCaptures[0];
    const opts = Object.fromEntries(captureOptions(s, cap).map((o) => [o.id, o]));
    expect(Object.keys(opts)).toEqual(['conquer', 'raze', 'tributary', 'free']);
    expect(opts.raze.disabled).toBe(false);
    expect(opts.tributary.disabled).toBe(true);
    expect(opts.tributary.reason).toMatch(/no independent cities/);
    expect(resolveCapture(s, cap.id, 'tributary').reason).toBe(opts.tributary.reason);
    const burnt = resolveCapture(s, cap.id, 'raze');
    expect(burnt.regions[T].razing).toMatchObject({ by: 'fr' });
    expect(burnt.pendingCaptures).toHaveLength(0);
  });

  it('a capture left open when the turn ends keeps the city (headless loops never stall)', () => {
    const s = applyBattleOutcome(armies(), outcomeOf(armies(), 'attacker'));
    const settled = settleOpenCaptures(s);
    expect(settled.pendingCaptures).toHaveLength(0);
    expect(settled.regions[T].owner).toBe('fr');
  });
});

describe('the peoples world: tributary and free', () => {
  const world = () => createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  // The player takes the nearest independent's city by force.
  const taken = () => {
    const s = world();
    const me = s.playerNationId;
    const capital = s.regions[s.nations[me].capitalRegionId];
    const ind = Object.values(s.nations).filter((n) => isIndependentNation(n) && !n.isEliminated && s.regions[n.capitalRegionId])
      .sort((a, b) => Math.hypot(...[0, 1, 2].map((k) => tiles.centres[s.regions[a.capitalRegionId].tile][k] - tiles.centres[capital.tile][k])) - Math.hypot(...[0, 1, 2].map((k) => tiles.centres[s.regions[b.capitalRegionId].tile][k] - tiles.centres[capital.tile][k])))[0];
    const cityId = ind.capitalRegionId;
    const r = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, cityId, me, null);
    const units = { ...s.units, occ: { ...unit('occ', cityId, me), tile: s.regions[cityId].tile } };
    const next = openCapture({ ...s, regions: r.regions, nations: r.nations, units }, { opId: 'x1', cityId, by: me, from: ind.id });
    return { s: next, cityId, indId: ind.id, me };
  };

  it('Make tributary: the city stands as an independent that pays tribute, with a truce, and the troops step out', () => {
    const { s, cityId, indId, me } = taken();
    const opt = captureOptions(s, s.pendingCaptures[0]).find((o) => o.id === 'tributary');
    expect(opt.disabled).toBe(false);
    const next = gameReducer(s, { type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: s.pendingCaptures[0].id, choice: 'tributary' } });
    expect(next.regions[cityId].owner).toBe(indId);
    const indep = next.nations[indId];
    expect(indep.isEliminated).toBe(false);
    expect(indep.indep.tributeTo[me].until).toBe(s.turnNumber + CAPTURE_TRIBUTE_TURNS);
    expect(indep.indep.truceWith[me]).toBe(s.turnNumber + CAPTURE_TRIBUTE_TURNS);
    expect(indep.indep.gold).toBeGreaterThan(0);
    expect(next.units.occ.tile).not.toBe(next.regions[cityId].tile);
    expect(next.regions[next.units.occ.regionId].owner).toBe(me);
    expect(auditGameState(next).filter((i) => i.severity === 'error' && /occ/.test(i.path || ''))).toEqual([]);
  });

  it('Free: the city stands free and friendly, without tribute', () => {
    const { s, cityId, indId, me } = taken();
    const next = resolveCapture(s, s.pendingCaptures[0].id, 'free');
    expect(next.regions[cityId].owner).toBe(indId);
    expect(next.nations[indId].indep.tributeTo?.[me]).toBeUndefined();
    expect(next.nations[indId].indep.favour[me]).toBeGreaterThan(0);
  });
});

describe('occupation (I126, I127) and the anti-loop history (I132)', () => {
  const conquered = (turn = 5) => {
    const s = { ...armies(), turnNumber: turn };
    const r = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: turn }, T, 'fr', null);
    const units = { ...s.units }; delete units.d1;
    return { ...s, regions: r.regions, nations: r.nations, units };
  };

  it('a fresh conquest has a grace; the same nation taking it again soon gets none', () => {
    const s = conquered(5);
    expect(s.regions[T].conquest.graceUntil).toBe(5 + OCCUPATION_GRACE_TURNS);
    expect(s.regions[T].captureLog).toEqual([{ by: 'fr', from: AGG, turn: 5 }]);
    // Lost and retaken within CAPTURE_REPEAT_TURNS: no second grace, no second prize.
    const lost = { ...s.regions, [T]: { ...s.regions[T], owner: AGG, conquest: undefined } };
    const again = conquerRegion({ regions: lost, nations: s.nations, turnNumber: 5 + CAPTURE_REPEAT_TURNS - 1 }, T, 'fr', null);
    expect(again.regions[T].conquest.repeat).toBe(true);
    expect(again.regions[T].conquest.graceUntil).toBeUndefined();
    expect(again.regions[T].captureLog).toHaveLength(2);
  });

  it('inside the grace a city never breaks away, and its loyalty holds at the floor', () => {
    let s = conquered(5);
    const regions = { ...s.regions };
    for (let turn = 6; turn < 5 + OCCUPATION_GRACE_TURNS; turn++) {
      const out = applyLoyalty({ ...s, turnNumber: turn }, regions, s.units, { ...s.nations }, turn);
      expect(out.flips.find((f) => f.cityId === T)).toBeUndefined();
    }
    expect(regions[T].owner).toBe('fr');
    expect(regions[T].loyalty).toBeGreaterThanOrEqual(OCCUPATION_GRACE_FLOOR);
  });

  it('a garrison holds an occupied city better, and the forecast says when it would break away', () => {
    const s = conquered(5);
    const bare = loyaltyTarget(s, s.regions[T]);
    const held = { ...s, units: { ...s.units, g1: { ...unit('g1', T, 'fr'), tile: s.regions[T].tile }, g2: { ...unit('g2', T, 'fr'), tile: s.regions[T].tile } } };
    expect(loyaltyTarget(held, held.regions[T]).garrison).toBe(2 * LOYALTY_OCCUPATION_PER_UNIT);
    expect(loyaltyTarget(held, held.regions[T]).total).toBeGreaterThan(bare.total);
    const f = loyaltyForecast(s, s.regions[T]);
    expect(f.graceLeft).toBe(OCCUPATION_GRACE_TURNS);
    if (bare.total <= 0) expect(f.breaksIn).toBeGreaterThanOrEqual(OCCUPATION_GRACE_TURNS);
    expect(f.garrison.gain).toBe(LOYALTY_OCCUPATION_PER_UNIT);
  });
});

describe('the breach (I131): a healthy garrison does not hand over its city at 0 HP', () => {
  it('holds while it has the men and is not encircled, at a cost, for a bounded number of turns', () => {
    const s = armies();
    const city = s.regions[T];
    const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);
    // Two besiegers on one side (not encircled), a garrison of equal men, walls already at 0.
    const units = {
      b1: { ...unit('b1', FR, 'fr'), tile: ring[0] }, b2: { ...unit('b2', FR, 'fr'), tile: ring[0] },
      g1: { ...unit('g1', T, AGG), tile: city.tile }, g2: { ...unit('g2', T, AGG), tile: city.tile }
    };
    let regions = { ...s.regions, [T]: { ...city, siege: { hp: 0, maxHp: 500, by: 'fr', startedTurn: 1, encircled: false, starving: 0 } } };
    let held = 0;
    for (let turn = 2; turn < 2 + BREACH_HOLD_TURNS + 2; turn++) {
      const out = processSieges({ ...s, regions, units }, regions, units, { turn });
      if (out.fallen.some((f) => f.cityId === T)) break;
      held += 1;
      regions = { ...regions };
    }
    expect(held).toBe(BREACH_HOLD_TURNS);
    expect(units.g1.strength).toBeLessThan(1000);
  });
});
