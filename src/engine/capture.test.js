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
import { processSieges } from './sieges';
import { isIndependentNation } from '../data/independents';
import { syncWorldRegistry } from './world/registry';
import { auditGameState } from './stateAudit';
import { isNoMansLand } from './hostility';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { neighbourWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 1 });
const FR_ID = PEOPLES_WORLD.playerNationId;

const tiles = getTiles();

const WORLD = (() => {
  const first = addCity(neighbourWorld({ seed: 1 }), FR_ID);
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID);
  const near = addCity(first.state, FR_ID, { near: target });
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
    nations: { ...s.nations, [FR_ID]: { ...s.nations[FR_ID], isAtWar: true }, [AGG]: { ...s.nations[AGG], isAtWar: true } },
    wars: [...s.wars, { id: 'war_t', aggressor: FR_ID, enemy: AGG, active: true, startTurn: s.turnNumber, battleScore: 0 }],
    units: { a1: unit('a1', FR, FR_ID), a2: unit('a2', FR, FR_ID, 'cavalry'), d1: unit('d1', T, AGG) }
  };
};
const outcomeOf = (s, outcome, { id = 'op1', attacker = FR_ID, defender = AGG, kind = 'invasion', viewerId } = {}) => makeBattleOutcome({
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
    expect(won.regions[T].owner).toBe(FR_ID);
    expect(pendingCapturesOf(won)).toHaveLength(1);
    expect(pendingCapturesOf(won)[0]).toMatchObject({ cityId: T, by: FR_ID, from: AGG, source: 'battle' });
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
    // Here FR_ID plays the AI attacker and AGG the real player watching.
    const ai = applyBattleOutcome(s, outcomeOf(s, 'attacker', { id: 'op9', viewerId: AGG }));
    expect(ai.regions[T].owner).toBe(FR_ID);
    expect(ai.pendingCaptures || []).toHaveLength(0);
  });

  it('commits exactly once: a second answer finds nothing to do', () => {
    const s = applyBattleOutcome(armies(), outcomeOf(armies(), 'attacker'));
    const id = s.pendingCaptures[0].id;
    const kept = gameReducer(s, { type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: id, choice: 'conquer' } });
    expect(kept.pendingCaptures).toHaveLength(0);
    expect(kept.regions[T].owner).toBe(FR_ID);
    const again = gameReducer(kept, { type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: id, choice: 'raze' } });
    expect(again.regions).toBe(kept.regions);
    expect(again.nations[FR_ID].battleStats).toEqual(kept.nations[FR_ID].battleStats);
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
    expect(burnt.regions[T].razing).toMatchObject({ by: FR_ID });
    expect(burnt.pendingCaptures).toHaveLength(0);
  });

  it('a capture left open when the turn ends keeps the city (headless loops never stall)', () => {
    const s = applyBattleOutcome(armies(), outcomeOf(armies(), 'attacker'));
    const settled = settleOpenCaptures(s);
    expect(settled.pendingCaptures).toHaveLength(0);
    expect(settled.regions[T].owner).toBe(FR_ID);
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
    const r = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: turn }, T, FR_ID, null);
    const units = { ...s.units }; delete units.d1;
    return { ...s, regions: r.regions, nations: r.nations, units };
  };

  it('a fresh conquest has a grace; the same nation taking it again soon gets none', () => {
    const s = conquered(5);
    expect(s.regions[T].conquest.graceUntil).toBe(5 + OCCUPATION_GRACE_TURNS);
    expect(s.regions[T].captureLog).toEqual([{ by: FR_ID, from: AGG, turn: 5 }]);
    // Lost and retaken within CAPTURE_REPEAT_TURNS: no second grace, no second prize.
    const lost = { ...s.regions, [T]: { ...s.regions[T], owner: AGG, conquest: undefined } };
    const again = conquerRegion({ regions: lost, nations: s.nations, turnNumber: 5 + CAPTURE_REPEAT_TURNS - 1 }, T, FR_ID, null);
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
    expect(regions[T].owner).toBe(FR_ID);
    expect(regions[T].loyalty).toBeGreaterThanOrEqual(OCCUPATION_GRACE_FLOOR);
  });

  it('a garrison holds an occupied city better, and the forecast says when it would break away', () => {
    const s = conquered(5);
    const bare = loyaltyTarget(s, s.regions[T]);
    const held = { ...s, units: { ...s.units, g1: { ...unit('g1', T, FR_ID), tile: s.regions[T].tile }, g2: { ...unit('g2', T, FR_ID), tile: s.regions[T].tile } } };
    expect(loyaltyTarget(held, held.regions[T]).garrison).toBe(2 * LOYALTY_OCCUPATION_PER_UNIT);
    expect(loyaltyTarget(held, held.regions[T]).total).toBeGreaterThan(bare.total);
    const f = loyaltyForecast(s, s.regions[T]);
    expect(f.graceLeft).toBe(OCCUPATION_GRACE_TURNS);
    if (bare.total <= 0) expect(f.breaksIn).toBeGreaterThanOrEqual(OCCUPATION_GRACE_TURNS);
    expect(f.garrison.gain).toBe(LOYALTY_OCCUPATION_PER_UNIT);
  });
});

describe('a siege never takes a city (the 14 October rule)', () => {
  it('at 0 HP with no garrison the siege phase hands nothing over and costs nobody men', () => {
    const s = armies();
    const city = s.regions[T];
    const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);
    const units = { b1: { ...unit('b1', FR, FR_ID), tile: ring[0] }, g1: { ...unit('g1', T, AGG), tile: city.tile } };
    const regions = { ...s.regions, [T]: { ...city, siege: { hp: 0, maxHp: 500, by: FR_ID, startedTurn: 1, encircled: false } } };
    for (let turn = 2; turn < 8; turn++) processSieges({ ...s, regions, units }, regions, units, { turn });
    expect(regions[T].owner).toBe(AGG);
    expect(regions[T].siege.hp).toBe(0);
    expect(units.g1.strength).toBe(1000);
  });
});
describe('decision 41: no man\'s land is fought on Auto', () => {
  it('a land tile inside neither side\'s borders, a third people\'s included, is no man\'s land; own land and the sea are not', () => {
    const s = armies();
    const own = s.regions[FR].tile;
    const theirs = s.regions[T].tile;
    const third = Object.values(s.regions).find((r) => r.owner && r.owner !== FR_ID && r.owner !== AGG && r.tile != null && tiles.land[r.tile] === 1);
    const free = tiles.neighbors[own].concat(...tiles.neighbors[own].map((n) => tiles.neighbors[n])).find((t) => tiles.land[t] === 1 && s.world.tileOwner[t] == null);
    const sea = Array.from({ length: tiles.land.length }, (_, i) => i).find((t) => tiles.land[t] !== 1);
    expect(isNoMansLand(s, own, FR_ID, AGG)).toBe(false);
    expect(isNoMansLand(s, theirs, FR_ID, AGG)).toBe(false);
    expect(isNoMansLand(s, third.tile, FR_ID, AGG)).toBe(true);
    if (free != null) expect(isNoMansLand(s, free, FR_ID, AGG)).toBe(true);
    expect(isNoMansLand(s, sea, FR_ID, AGG)).toBe(false);
  });
});

describe('an empty city battered to 0 HP by a siege', () => {
  it('stays in its owner\'s hands through the turn: no surrender, no card', () => {
    const s0 = armies();
    const city = s0.regions[T];
    const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);
    const units = { b1: { ...unit('b1', FR, FR_ID), tile: ring[0] }, b2: { ...unit('b2', FR, FR_ID), tile: ring[0] } };
    const s = {
      ...s0, units, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true },
      regions: { ...s0.regions, [T]: { ...city, siege: { hp: 0, maxHp: 500, by: FR_ID, startedTurn: 1, encircled: false } } }
    };
    const next = resolveTurn(s);
    expect(next.regions[T].owner).toBe(AGG);
    expect(pendingCapturesOf(next)).toHaveLength(0);
  });
});