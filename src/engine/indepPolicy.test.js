// Phase W3: majors and independents (plans/independent-cities.md 4.5, 5 and 6; src/engine/indepPolicy.js,
// razing.js and the siege force and raider hunt in aiOperations.js).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import {
  isIndependentNation, GIFT_GOLD, GIFT_FAVOUR, GRUDGE_RAZE_KIN, GRUDGE_REFUSED, JOIN_KM, CONQUER_KM, TRADE_KM, tributeGold, tradeGoldOf, INDEP_POLICY_PERIOD
} from '../data/independents';
import { ringsAround } from './world/cities';
import { processMajorsAndIndependents, attitudeOf, joinCheck, mayJoin } from './indepPolicy';
import { canRaze, burnCities } from './razing';
import { canFight } from './hostility';
import { grudgeOf } from './grudges';
import { thinksOn } from './raids';
import { aiHuntRaiders, raidPartyTiles } from './aiOperations';
import { createRng } from '../utils/rng';
import { auditGameState } from './stateAudit';
import { PEOPLES } from '../data/peoples';
import { opinionReasons } from './opinion';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const world = () => {
  const s = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  return { ...s, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
};
const unit = (id, owner, regionId, tile, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });

// The nearest independent to a major's capital (optionally of some personalities), within `km`.
const nearestIndependent = (s, majorId, km, personalities = null) => {
  const tiles = getTiles();
  const capital = s.regions[s.nations[majorId].capitalRegionId];
  const near = ringsAround(tiles, capital.tile, ringsForKm(km));
  return Object.values(s.nations)
    .filter((n) => isIndependentNation(n) && !n.isEliminated && near.has(s.regions[n.capitalRegionId]?.tile) && (!personalities || personalities.includes(n.indep.personality)))
    .sort((a, b) => near.get(s.regions[a.capitalRegionId].tile) - near.get(s.regions[b.capitalRegionId].tile) || (a.id < b.id ? -1 : 1))[0];
};
// A major (not the player) with an independent of these personalities within `km` of its capital.
const majorWithNeighbour = (s, km, personalities = null) => {
  for (const m of Object.values(s.nations).filter((n) => !isIndependentNation(n) && !n.isPlayer && !n.isEliminated).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ind = nearestIndependent(s, m.id, km, personalities);
    if (ind) return { major: m, ind };
  }
  return null;
};
// The player's units on its capital: `n` fresh infantry.
const armPlayer = (s, n) => {
  const me = s.playerNationId;
  const cap = s.regions[s.nations[me].capitalRegionId];
  const units = { ...s.units };
  for (let i = 0; i < n; i++) units[`p${i}`] = unit(`p${i}`, me, cap.id, cap.tile);
  return { ...s, units };
};
// One turn of the W3 phase alone, applied like resolveTurn applies it.
const step = (s) => {
  const turnNumber = s.turnNumber + 1;
  const out = processMajorsAndIndependents({ ...s, turnNumber });
  if (!out) return { ...s, turnNumber };
  return { ...s, turnNumber, regions: out.regions, units: out.units, nations: out.nations, resources: out.resources, world: out.world, wars: out.wars, joinOffers: out.joinOffers, indepStats: out.indepStats, logs: [...s.logs, ...out.logs] };
};
// Hand an independent's city to `taker` by force (a conquest marker, the independent gone).
const takeCity = (s, indId, taker) => {
  const ind = s.nations[indId];
  const city = s.regions[ind.capitalRegionId];
  const units = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.ownerId !== indId));
  return {
    ...s, units,
    regions: { ...s.regions, [city.id]: { ...city, owner: taker, conquest: { warId: null, from: indId, turn: s.turnNumber }, formerOwner: indId, isCapital: false } },
    nations: { ...s.nations, [indId]: { ...ind, isEliminated: true } }
  };
};

describe('W3 attitude and joining (independents 4.5)', () => {
  it('only tribal, mercantile and free cities that are not fortresses may join', () => {
    expect(mayJoin({ indep: { personality: 'tribal' } })).toBe(true);
    expect(mayJoin({ indep: { personality: 'mercantile' } })).toBe(true);
    expect(mayJoin({ indep: { personality: 'raiders' } })).toBe(false);
    expect(mayJoin({ indep: { personality: 'raiders', freeCity: true } })).toBe(true);
    expect(mayJoin({ indep: { personality: 'fortress', freeCity: true } })).toBe(false);
  });

  it('a gift costs GIFT_GOLD and buys GIFT_FAVOUR, which raises the attitude', () => {
    const s0 = world();
    const ind = nearestIndependent(s0, 'akkad', CONQUER_KM);
    const s = { ...s0, resources: { ...s0.resources, gold: 500 } };
    const before = attitudeOf(s, ind.id, 'akkad');
    const after = gameReducer(s, { type: ActionTypes.GIFT_INDEPENDENT, payload: { independentId: ind.id } });
    expect(after.resources.gold).toBe(500 - GIFT_GOLD);
    expect(after.nations[ind.id].indep.favour.akkad).toBe(GIFT_FAVOUR);
    expect(attitudeOf(after, ind.id, 'akkad')).toBe(before + GIFT_FAVOUR);
    expect(opinionReasons(after, ind.id, 'akkad').some((r) => r.id === 'favour')).toBe(true);
    // No gold, no gift.
    const broke = gameReducer({ ...s, resources: { ...s.resources, gold: 10 } }, { type: ActionTypes.GIFT_INDEPENDENT, payload: { independentId: ind.id } });
    expect(broke.nations[ind.id].indep.favour).toBeUndefined();
  });

  it('the player asks a tribal neighbour to join: refused with the reason, then accepted with a big army and favour', () => {
    let s = world();
    const ind = nearestIndependent(s, 'akkad', JOIN_KM, ['tribal', 'mercantile']);
    expect(ind).toBeTruthy();
    const refused = gameReducer(s, { type: ActionTypes.PROPOSE_JOINING, payload: { independentId: ind.id } });
    expect(refused.regions[ind.capitalRegionId].owner).toBe(ind.id);
    expect(refused.logs.at(-1).message).toMatch(/attitude/);
    // Favour up to the cap and an army five times theirs.
    s = { ...s, nations: { ...s.nations, [ind.id]: { ...s.nations[ind.id], indep: { ...s.nations[ind.id].indep, favour: { akkad: 50 } } } } };
    const theirs = Object.values(s.units).filter((u) => u.ownerId === ind.id).length;
    s = armPlayer(s, 5 * theirs + 1);
    expect(joinCheck(s, ind.id, 'akkad')).toMatchObject({ ok: true, how: 'strength' });
    const aeBefore = JSON.stringify(Object.values(s.nations).map((n) => n.ae?.akkad || 0));
    const joined = gameReducer(s, { type: ActionTypes.PROPOSE_JOINING, payload: { independentId: ind.id } });
    const city = joined.regions[ind.capitalRegionId];
    expect(city.owner).toBe('akkad');
    expect(city.joinedTurn).toBe(s.turnNumber);
    expect(city.conquest).toBeUndefined();
    expect(joined.nations[ind.id].isEliminated).toBe(true);
    // Its soldiers serve the player; no aggressive expansion.
    expect(Object.values(joined.units).some((u) => u.ownerId === ind.id)).toBe(false);
    expect(Object.values(joined.units).filter((u) => u.regionId === city.id && u.ownerId === 'akkad').length).toBe(theirs);
    expect(JSON.stringify(Object.values(joined.nations).map((n) => n.ae?.akkad || 0))).toBe(aeBefore);
    expect(auditGameState(joined).filter((v) => v.code !== 'city_spacing')).toEqual([]);
  });

  it('a fortress never joins', () => {
    const s = world();
    const fort = Object.values(s.nations).find((n) => n.indep?.personality === 'fortress');
    expect(joinCheck(s, fort.id, 'akkad').ok).toBe(false);
    expect(joinCheck(s, fort.id, 'akkad').reason).toMatch(/fortress/i);
  });

  it('an independent that would join the player offers it on its think turn; accepting hands the city over', () => {
    let s = world();
    const ind = nearestIndependent(s, 'akkad', JOIN_KM, ['tribal', 'mercantile']);
    s = { ...s, nations: { ...s.nations, [ind.id]: { ...s.nations[ind.id], indep: { ...s.nations[ind.id].indep, favour: { akkad: 50 } } } } };
    s = armPlayer(s, 5 * Object.values(s.units).filter((u) => u.ownerId === ind.id).length + 1);
    let guard = 0;
    while (!(s.joinOffers || []).length && guard++ < 6) s = step(s);
    expect(s.joinOffers).toHaveLength(1);
    expect(thinksOn(ind.id, s.turnNumber)).toBe(true);
    const offer = s.joinOffers[0];
    expect(offer.indepId).toBe(ind.id);
    const accepted = gameReducer(s, { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: offer.id, accept: true } });
    expect(accepted.regions[ind.capitalRegionId].owner).toBe('akkad');
    expect(accepted.joinOffers).toEqual([]);
    const declined = gameReducer(s, { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: offer.id, accept: false } });
    expect(declined.regions[ind.capitalRegionId].owner).toBe(ind.id);
  });

  it('an AI major with an army five times its own and attitude 40 absorbs a joinable neighbour', () => {
    let s = world();
    const pair = majorWithNeighbour(s, JOIN_KM, ['tribal', 'mercantile']);
    const { major, ind } = pair;
    const cap = s.regions[major.capitalRegionId];
    const units = { ...s.units };
    const theirs = Object.values(s.units).filter((u) => u.ownerId === ind.id).length;
    for (let i = 0; i <= 5 * theirs; i++) units[`m${i}`] = unit(`m${i}`, major.id, cap.id, cap.tile);
    s = { ...s, units, nations: { ...s.nations, [ind.id]: { ...s.nations[ind.id], indep: { ...s.nations[ind.id].indep, favour: { [major.id]: 50 } } } } };
    let guard = 0;
    while (s.regions[ind.capitalRegionId].owner === ind.id && guard++ < 6) s = step(s);
    expect(s.regions[ind.capitalRegionId].owner).toBe(major.id);
    expect(s.indepStats.joined).toBe(1);
    expect(s.nations[ind.id].isEliminated).toBe(true);
  });
});

describe('W3 tribute to majors and trade', () => {
  it('a demand backed by three times its strength is paid (a truce both ways), else refused with a grudge', () => {
    let s = world();
    const ind = nearestIndependent(s, 'akkad', CONQUER_KM, ['tribal', 'mercantile']);
    const weak = gameReducer(s, { type: ActionTypes.DEMAND_INDEPENDENT_TRIBUTE, payload: { independentId: ind.id } });
    expect(weak.nations[ind.id].indep.tributeTo).toBeUndefined();
    expect(grudgeOf(weak.nations[ind.id], 'akkad')).toBe(GRUDGE_REFUSED);
    s = armPlayer(s, 3 * Object.values(s.units).filter((u) => u.ownerId === ind.id).length + 1);
    const paid = gameReducer(s, { type: ActionTypes.DEMAND_INDEPENDENT_TRIBUTE, payload: { independentId: ind.id } });
    expect(paid.nations[ind.id].indep.tributeTo.akkad.gold).toBe(tributeGold(s.age));
    expect(canFight(paid, 'akkad', ind.id)).toBe(false);
    // It pays from its treasury every turn.
    const rich = { ...paid, nations: { ...paid.nations, [ind.id]: { ...paid.nations[ind.id], indep: { ...paid.nations[ind.id].indep, gold: 100 } } } };
    const next = step(rich);
    expect(next.resources.gold).toBe(rich.resources.gold + tributeGold(s.age));
    expect(opinionReasons(next, ind.id, 'akkad').some((r) => r.id === 'tributary')).toBe(true);
  });

  it('a mercantile city trades: gold both ways every turn', () => {
    const w0 = world();
    // Play a major with a mercantile neighbour (the player's own seat in this world has none near).
    const { major, ind: merc } = majorWithNeighbour(w0, TRADE_KM, ['mercantile']);
    const me = major.id;
    const s0 = { ...w0, playerNationId: me };
    const tribal = Object.values(s0.nations).find((n) => n.indep?.personality === 'tribal');
    expect(gameReducer(s0, { type: ActionTypes.PROPOSE_INDEPENDENT_TRADE, payload: { independentId: tribal.id } }).nations[tribal.id].indep.tradeWith).toBeUndefined();
    const s = gameReducer(s0, { type: ActionTypes.PROPOSE_INDEPENDENT_TRADE, payload: { independentId: merc.id } });
    expect(s.nations[merc.id].indep.tradeWith[me]).toBe(s0.turnNumber);
    const goldBefore = s.nations[merc.id].indep.gold || 0;
    const next = step(s);
    expect(next.resources.gold).toBe(s.resources.gold + tradeGoldOf(s.age));
    expect(next.nations[merc.id].indep.gold).toBeGreaterThanOrEqual(Math.min(400, goldBefore + tradeGoldOf(s.age)) - 1);
    expect(opinionReasons(next, merc.id, me).some((r) => r.id === 'tradesWithUs')).toBe(true);
  });
});

describe('W3 razing (independents 5, decision 3)', () => {
  it('a city taken by force burns one size a turn, frees its land when gone, and its kin remember', () => {
    let s = world();
    const ind = nearestIndependent(s, 'akkad', CONQUER_KM);
    const cityId = ind.capitalRegionId;
    s = takeCity(s, ind.id, 'akkad');
    s = { ...s, regions: { ...s.regions, [cityId]: { ...s.regions[cityId], size: 3 } } };
    expect(canRaze(s, 'akkad', cityId).ok).toBe(true);
    expect(canRaze(s, 'akkad', s.nations.akkad.capitalRegionId).ok).toBe(false);
    const theme = PEOPLES[ind.people]?.theme;
    const kin = Object.values(s.nations).find((n) => n.id !== ind.id && isIndependentNation(n) && !n.isEliminated && PEOPLES[n.people]?.theme === theme);
    s = gameReducer(s, { type: ActionTypes.RAZE_CITY, payload: { regionId: cityId } });
    expect(s.regions[cityId].razing).toEqual({ by: 'akkad', startedTurn: s.turnNumber });
    if (kin) expect(grudgeOf(s.nations[kin.id], 'akkad')).toBe(GRUDGE_RAZE_KIN);
    const tiles = [...s.regions[cityId].tiles];
    const sizes = [];
    for (let t = 0; t < 3; t++) {
      s = step(s);
      sizes.push(s.regions[cityId]?.size ?? 0);
    }
    expect(sizes).toEqual([2, 1, 0]);
    expect(s.regions[cityId]).toBeUndefined();
    tiles.forEach((t) => expect(s.world.tileOwner[t]).toBeUndefined());
    expect(s.indepStats.razed).toBe(1);
    expect(auditGameState(s).filter((v) => v.code !== 'city_spacing')).toEqual([]);
  });

  it('a burning city yields nothing, and anyone who retakes it puts the fire out', () => {
    let s = world();
    const ind = nearestIndependent(s, 'akkad', CONQUER_KM);
    const cityId = ind.capitalRegionId;
    s = takeCity(s, ind.id, 'akkad');
    s = gameReducer(s, { type: ActionTypes.RAZE_CITY, payload: { regionId: cityId } });
    const burned = resolveTurn(s);
    expect(burned.regions[cityId].lastYields.gold).toBe(0);
    // Retaken by someone else: the order is the razer's, so the fire stops.
    const other = Object.keys(s.nations).find((id) => id !== 'akkad' && !isIndependentNation(s.nations[id]) && !s.nations[id].isEliminated);
    const regions = { ...s.regions, [cityId]: { ...s.regions[cityId], owner: other } };
    const fire = burnCities({ regions, nations: { ...s.nations }, units: { ...s.units }, world: { ...s.world }, wars: [...s.wars], playerNationId: 'akkad', year: s.year });
    expect(fire.stopped).toBe(1);
    expect(regions[cityId].razing).toBeUndefined();
    // The player may also stop it.
    const stopped = gameReducer(s, { type: ActionTypes.STOP_RAZING, payload: { regionId: cityId } });
    expect(stopped.regions[cityId].razing).toBeUndefined();
  });
});

describe('W3 AI majors against independents (independents 5)', () => {
  it('a major hunts a raid party standing on its land beside its garrison', () => {
    let s = world();
    const { major, ind } = majorWithNeighbour(s, CONQUER_KM);
    const cap = s.regions[major.capitalRegionId];
    const tiles = getTiles();
    const spot = tiles.neighbors[cap.tile].find((t) => s.world.tileOwner[t] === cap.id && tiles.land[t] === 1);
    const units = { ...s.units };
    for (let i = 0; i < 4; i++) units[`g${i}`] = unit(`g${i}`, major.id, cap.id, cap.tile);
    units.raider = unit('raider', ind.id, ind.capitalRegionId, spot, { raidOf: ind.id, strength: 400 });
    s = { ...s, units };
    expect(raidPartyTiles(s).has(spot)).toBe(true);
    const out = aiHuntRaiders(s, major.id, raidPartyTiles(s), createRng(5));
    expect(!out.units.raider || out.units.raider.strength < 400).toBe(true);
  });

  it('a major with spare armies twice the garrison picks a campaign (or musters) within a few think turns', () => {
    let s = world();
    const { major, ind } = majorWithNeighbour(s, CONQUER_KM);
    const cap = s.regions[major.capitalRegionId];
    const units = { ...s.units };
    const garrison = Object.values(s.units).filter((u) => u.ownerId === ind.id).length;
    for (let i = 0; i < 2 * garrison + 2; i++) units[`m${i}`] = unit(`m${i}`, major.id, cap.id, cap.tile);
    s = { ...s, units, nations: { ...s.nations, [major.id]: { ...s.nations[major.id], economy: { ...(s.nations[major.id].economy || {}), gold: 0 } } } };
    let guard = 0;
    while (!s.nations[major.id].indepGoal && guard++ < 10 * INDEP_POLICY_PERIOD) s = step(s);
    expect(['conquer', 'muster']).toContain(s.nations[major.id].indepGoal?.kind);
    if (s.nations[major.id].indepGoal.kind === 'conquer') expect(Object.values(s.units).some((u) => u.ownerId === major.id && u.indepOp === s.nations[major.id].indepGoal.id)).toBe(true);
  });

  it('a siege force marches on the independent, besieges it and takes it, with no war', () => {
    let s = world();
    const { major, ind } = majorWithNeighbour(s, CONQUER_KM);
    const cap = s.regions[major.capitalRegionId];
    const units = { ...s.units };
    const garrison = Object.values(s.units).filter((u) => u.ownerId === ind.id).length;
    for (let i = 0; i < 2 * garrison + 2; i++) units[`m${i}`] = unit(`m${i}`, major.id, cap.id, cap.tile, { indepOp: ind.id });
    s = { ...s, units, nations: { ...s.nations, [major.id]: { ...s.nations[major.id], indepGoal: { id: ind.id, cityId: ind.capitalRegionId, kind: 'conquer', since: s.turnNumber } } } };
    const warsBefore = s.wars.length;
    for (let t = 0; t < 60 && s.regions[ind.capitalRegionId].owner === ind.id; t++) {
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
    }
    expect(s.regions[ind.capitalRegionId].owner).toBe(major.id);
    expect(s.indepStats.conquered).toBeGreaterThanOrEqual(1);
    expect(s.wars.filter((w) => w.aggressor === major.id || w.enemy === major.id).length).toBeLessThanOrEqual(warsBefore);
    // The campaign is over: no unit is tagged for it any more.
    s = resolveTurn(s);
    expect(Object.values(s.units).some((u) => u.indepOp === ind.id)).toBe(false);
    expect(s.nations[major.id].indepGoal?.id === ind.id).toBe(false);
  }, 120000);
});
