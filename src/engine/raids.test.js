// Phase W2: the independents' AI, raids, sacks, grudges, tribute and mercenaries
// (plans/independent-cities.md 4 and 5, plans/MASTER-PLAN.md 6.5, 6.7, 6.8; src/engine/raids.js).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import {
  RAID_KM, GRUDGE_MAX, GRUDGE_DECAY, GRUDGE_KIN_CITY, MERC_CONTRACT_TURNS, MERC_STOCK, TRIBUTE_TURNS, tributeGold, mercPrice, garrisonTarget, isIndependentNation
} from '../data/independents';
import { ringsAround } from './world/cities';
import { processIndependents, sackedCity, startTribute, thinksOn } from './raids';
import { withGrudge, decayGrudges, grudgeForKinCity, grudgeOf } from './grudges';
import { mercOffer, processMercenaries } from './mercenaries';
import { canFight } from './hostility';
import { fightRaidBattle } from './raidBattle';
import { createRng } from '../utils/rng';
import { PEOPLES } from '../data/peoples';
import { auditGameState } from './stateAudit';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const world = () => {
  const s = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  return { ...s, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
};
const unit = (id, owner, regionId, tile, classId = 'infantry') => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });

// One turn of the independents' phase alone, applied like resolveTurn applies it.
const step = (s) => {
  const turnNumber = s.turnNumber + 1;
  const out = processIndependents({ ...s, turnNumber });
  return { ...s, turnNumber, regions: out.regions, units: out.units, nations: out.nations, resources: out.resources, world: out.world, tributeDemands: out.tributeDemands, indepStats: out.indepStats, logs: [...s.logs, ...out.logs] };
};

// The raiders independent nearest the player's capital, and the player's tile nearest to it.
const raidersNearPlayer = (s) => {
  const tiles = getTiles();
  const me = s.playerNationId;
  const capital = s.regions[s.nations[me].capitalRegionId];
  const reach = ringsForKm(RAID_KM.raiders);
  const near = ringsAround(tiles, capital.tile, reach + 3);
  const cands = Object.values(s.nations).filter((n) => n.indep?.personality === 'raiders' && near.has(s.regions[n.capitalRegionId]?.tile))
    .sort((a, b) => near.get(s.regions[a.capitalRegionId].tile) - near.get(s.regions[b.capitalRegionId].tile));
  return cands[0];
};

// Strip the world down to the player and one raiders independent (no other hand in the test).
const duel = () => {
  let s = world();
  const raider = raidersNearPlayer(s);
  const me = s.playerNationId;
  const keep = new Set([me, raider.id]);
  const nations = { ...s.nations };
  Object.keys(nations).forEach((id) => { if (!keep.has(id) && isIndependentNation(nations[id])) nations[id] = { ...nations[id], isEliminated: true }; });
  const units = {};
  Object.values(s.units).forEach((u) => { if (u.ownerId !== me && u.ownerId !== raider.id) units[u.id] = u; });
  const home = s.regions[raider.capitalRegionId];
  // A full garrison plus a raid party of three.
  const n = garrisonTarget(home.size, 'raiders') + 3;
  for (let i = 0; i < n; i++) units[`r${i}`] = unit(`r${i}`, raider.id, home.id, home.tile);
  s = { ...s, nations: { ...nations, [raider.id]: { ...nations[raider.id], indep: { ...nations[raider.id].indep, lastRaidTurn: null } } }, units };
  return { s, raider: s.nations[raider.id], home };
};

describe('W2 data and pure rules', () => {
  it('a sack takes one size and one building tier, never more than half (the 50% rule)', () => {
    const city = { id: 'c1', size: 4, currentPopulation: 99999999, buildings: { categories: { food: 1, culture: 0, military: -1 } } };
    const s = sackedCity(city, 7);
    expect(s.city.size).toBe(3);
    expect(s.city.buildings.categories.food).toBe(0);
    expect(s.city.buildings.categories.culture).toBe(0);
    expect(s.city.sackedTurn).toBe(7);
    expect(sackedCity({ ...city, size: 1 }, 7).city.size).toBe(1);
    // A lone first-tier building stays (half of one building is none lost).
    expect(sackedCity({ id: 'c', size: 2, buildings: { categories: { food: 0 } } }, 1).lostBuilding).toBe(null);
    expect(sackedCity({ id: 'c', size: 2, buildings: { categories: { food: 0, culture: 0 } } }, 1).city.buildings.categories).toEqual({ food: 0, culture: -1 }); // ties by name
  });

  it('grudges clamp, decay and spread to kin when a city of the same theme falls', () => {
    const s = world();
    const indeps = Object.values(s.nations).filter((n) => isIndependentNation(n));
    const a = indeps[0];
    let n = withGrudge(a, 'akkad', 70);
    n = withGrudge(n, 'akkad', 70);
    expect(grudgeOf(n, 'akkad')).toBe(GRUDGE_MAX);
    expect(grudgeOf(decayGrudges(n), 'akkad')).toBe(GRUDGE_MAX - GRUDGE_DECAY);
    expect(withGrudge(s.nations.akkad, 'kemet', 20)).toBe(s.nations.akkad); // only independents hold grudges
    const theme = PEOPLES[a.people].theme;
    const kin = indeps.filter((x) => x.id !== a.id && PEOPLES[x.people]?.theme === theme);
    const after = grudgeForKinCity(s.nations, a.id, 'akkad');
    kin.forEach((k) => expect(grudgeOf(after[k.id], 'akkad')).toBe(GRUDGE_KIN_CITY));
  });

  it('every independent thinks once every three turns', () => {
    const s = world();
    const ids = Object.keys(s.nations).filter((id) => s.nations[id].indep).slice(0, 20);
    ids.forEach((id) => expect([1, 2, 3].filter((t) => thinksOn(id, t))).toHaveLength(1));
  });

  it('the raid battle is one swappable function with the RaidBattleOutcome shape', () => {
    const s = world();
    const tile = s.regions[s.nations.akkad.capitalRegionId].tile;
    const r = fightRaidBattle(s, { kind: 'raid', defenderId: 'akkad', tile, attackerUnits: [unit('a', 'x', 'c', tile), unit('b', 'x', 'c', tile)], defenderUnits: [unit('d', 'akkad', 'c', tile)] }, createRng(5));
    expect(r).toMatchObject({ kind: 'raid' });
    expect(['attacker', 'defender', 'stalemate']).toContain(r.outcome);
    expect(r.raidersWon).toBe(r.outcome === 'attacker');
    expect(r.attackers).toHaveLength(2);
    expect(r.attackerLoss + r.defenderLoss).toBeGreaterThan(0);
  });
});

describe('W2 raids on the map', () => {
  it('a raider pillages the player\'s farms, the player is told and the route home follows', () => {
    const { s: start, raider } = duel();
    const me = start.playerNationId;
    // Farms on every tile of the player's land; the capital's garrison stays home.
    const tileState = { ...start.world.tileState };
    Object.values(start.regions).filter((c) => c.owner === me).forEach((c) => (c.tiles || []).forEach((t) => { if (t !== c.tile) tileState[t] = { ...(tileState[t] || {}), improvement: 'farm' }; }));
    let s = { ...start, world: { ...start.world, tileState } };
    let started = null; let hit = null;
    for (let i = 0; i < 40 && !hit; i++) {
      s = step(s);
      const raid = s.nations[raider.id].indep.raid;
      if (raid && !started) started = raid;
      if (s.indepStats.raidsOnPlayer > 0) hit = s;
    }
    expect(started).toBeTruthy();
    expect(started.targetNationId).toBe(me);
    expect(hit).toBeTruthy();
    const pillaged = Object.keys(hit.world.tileState).filter((t) => hit.world.tileState[t].pillaged);
    expect(pillaged.length).toBeGreaterThan(0);
    expect(hit.logs.some((l) => l.message.startsWith(raider.name) && /pillage/.test(l.message))).toBe(true);
    expect(hit.nations[me].raidedBy[raider.id]).toBe(hit.turnNumber);
    expect(hit.nations[raider.id].indep.gold).toBeGreaterThan(0);
    // The party walks home and garrisons again.
    let back = hit;
    for (let i = 0; i < 20 && back.nations[raider.id].indep.raid; i++) back = step(back);
    expect(back.nations[raider.id].indep.raid).toBe(null);
    expect(Object.values(back.units).some((u) => u.raidOf)).toBe(false);
  });

  it('raiders sack an unguarded city: gold, one size, never a capture', () => {
    const { s: start } = duel();
    const me = start.playerNationId;
    const capital = start.regions[start.nations[me].capitalRegionId];
    // No garrison anywhere, a bigger city.
    const units = {}; Object.values(start.units).forEach((u) => { if (u.ownerId !== me) units[u.id] = u; });
    let s = { ...start, units, regions: { ...start.regions, [capital.id]: { ...capital, size: 4, lastYields: { ...(capital.lastYields || {}), gold: 10 } } }, resources: { ...start.resources, gold: 500 } };
    let sacked = null;
    for (let i = 0; i < 40 && !sacked; i++) { s = step(s); if (s.indepStats.sacks > 0) sacked = s; }
    expect(sacked).toBeTruthy();
    const city = sacked.regions[capital.id];
    expect(city.owner).toBe(me);
    expect(city.size).toBe(3);
    expect(city.sackedTurn).toBe(sacked.turnNumber);
    expect(sacked.resources.gold).toBe(500 - 30);
    expect(sacked.logs.some((l) => /sack/.test(l.message))).toBe(true);
    expect(auditGameState(sacked).filter((v) => v.code !== 'eliminated_owner')).toEqual([]); // the duel fixture retires the other independents in place
  });

  const blockedRun = (size) => {
    const { s: start, raider } = duel();
    const me = start.playerNationId;
    const capital = start.regions[start.nations[me].capitalRegionId];
    const units = { ...start.units };
    Object.keys(units).forEach((id) => { if (units[id].ownerId === me) delete units[id]; });
    // A token guard in a richer city (a sack target), then an army of `size` across the party's road, far from its home.
    units.g = unit('g', me, capital.id, capital.tile);
    let s = { ...start, units, regions: { ...start.regions, [capital.id]: { ...capital, lastYields: { ...(capital.lastYields || {}), gold: 10 } } } };
    let placed = false;
    for (let i = 0; i < 40; i++) {
      const raid = s.nations[raider.id].indep.raid;
      if (!placed && raid?.phase === 'out' && raid.route.length > 2) {
        placed = true;
        s = { ...s, units: { ...s.units } };
        for (let k = 0; k < size; k++) s.units['wall' + k] = unit('wall' + k, me, capital.id, raid.route[raid.route.length - 2]);
      }
      s = step(s);
      if (placed && s.nations[raider.id].indep.raid?.phase !== 'out') break;
    }
    return { s, raider, me, placed };
  };

  it('a party meets a stronger army on its road and turns home without a fight', () => {
    const { s, raider, placed } = blockedRun(6);
    expect(placed).toBe(true);
    expect(s.indepStats.raidBattles).toBe(0);
    expect(s.nations[raider.id].indep.raid === null || s.nations[raider.id].indep.raid.phase === 'home').toBe(true);
  });

  it('a party fights a weaker army on its road; its losses leave a grudge, a beaten party goes home to recover', () => {
    const { s, raider, me, placed } = blockedRun(2);
    expect(placed).toBe(true);
    expect(s.indepStats.raidBattles).toBeGreaterThan(0);
    const n = s.nations[raider.id];
    expect(grudgeOf(n, me)).toBeGreaterThan(0);
    if (n.indep.raid?.lost) expect(n.indep.raid.phase).toBe('home');
  });
});

describe('W2 tribute', () => {
  it('the player pays: a truce both ways and gold each turn; refusing raises the grudge', () => {
    const { s: start, raider } = duel();
    const me = start.playerNationId;
    const demand = { id: 'trib_x', indepId: raider.id, gold: tributeGold('bronze'), turns: TRIBUTE_TURNS, turn: start.turnNumber, expires: start.turnNumber + 3 };
    const paid = gameReducer({ ...start, tributeDemands: [demand] }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: 'trib_x', pay: true } });
    expect(paid.tributeDemands).toEqual([]);
    expect(canFight(paid, me, raider.id)).toBe(false);
    const gold = paid.resources.gold;
    const next = step(paid);
    expect(next.resources.gold).toBe(gold - tributeGold('bronze'));
    const refused = gameReducer({ ...start, tributeDemands: [demand] }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: 'trib_x', pay: false } });
    expect(grudgeOf(refused.nations[raider.id], me)).toBe(20);
    expect(canFight(refused, me, raider.id)).toBe(true);
    // Silence is a refusal.
    const silent = step(step(step(step({ ...start, tributeDemands: [demand] }))));
    expect(silent.tributeDemands.some((d) => d.id === 'trib_x')).toBe(false);
    expect(grudgeOf(silent.nations[raider.id], me)).toBeGreaterThan(0);
  });

  it('a payer that cannot pay loses the deal', () => {
    const { s: start, raider } = duel();
    const me = start.playerNationId;
    const s = { ...start, nations: startTribute(start.nations, raider.id, me, 5, start.turnNumber), resources: { ...start.resources, gold: 0 } };
    const next = step(s);
    expect(next.nations[raider.id].indep.tributeFrom[me]).toBeUndefined();
    expect(canFight(next, me, raider.id)).toBe(true);
  });
});

describe('W2 mercenaries', () => {
  it('the player hires a band: paid, placed, upkeep each turn, gone at the end of the contract', () => {
    let s = world();
    const me = s.playerNationId;
    const seller = Object.values(s.nations).find((n) => ['mercantile', 'raiders'].includes(n.indep?.personality) && mercOffer(s, n.id, me).ok);
    expect(seller).toBeTruthy();
    s = { ...s, resources: { ...s.resources, gold: 1000 } };
    const hired = gameReducer(s, { type: ActionTypes.HIRE_MERCENARY, payload: { independentId: seller.id } });
    const band = Object.values(hired.units).find((u) => u.mercenary);
    expect(band).toBeTruthy();
    expect(band.ownerId).toBe(me);
    expect(hired.resources.gold).toBe(1000 - mercPrice('bronze'));
    expect(hired.nations[seller.id].indep.mercStock).toBe(MERC_STOCK - 1);
    // Upkeep, then the end of the contract.
    const w = { turn: s.turnNumber + 1, year: s.year, playerId: me, view: hired, units: { ...hired.units }, nations: { ...hired.nations }, resources: { ...hired.resources }, logs: [], stats: { mercsHired: 0 } };
    w.view = { ...hired, units: w.units, nations: w.nations };
    processMercenaries(w);
    expect(w.resources.gold).toBe(hired.resources.gold - band.mercenary.upkeep);
    expect(w.units[band.id]).toBeTruthy();
    w.turn = s.turnNumber + MERC_CONTRACT_TURNS;
    processMercenaries(w);
    expect(w.units[band.id]).toBeUndefined();
    expect(w.logs.some((l) => /contract/.test(l.message))).toBe(true);
  });

  it('refuses a seller that is no market, a buyer it hates or one too poor', () => {
    const s = { ...world() };
    const me = s.playerNationId;
    const tribal = Object.values(s.nations).find((n) => n.indep?.personality === 'tribal');
    expect(mercOffer(s, tribal.id, me).ok).toBe(false);
    const seller = Object.values(s.nations).find((n) => ['mercantile', 'raiders'].includes(n.indep?.personality) && mercOffer(s, n.id, me).ok);
    const hating = { ...s, nations: { ...s.nations, [seller.id]: withGrudge(seller, me, 80) } };
    expect(mercOffer(hating, seller.id, me).ok).toBe(false);
    const poor = gameReducer({ ...s, resources: { ...s.resources, gold: 0 } }, { type: ActionTypes.HIRE_MERCENARY, payload: { independentId: seller.id } });
    expect(Object.values(poor.units).some((u) => u.mercenary)).toBe(false);
  });
});

describe('W2 through resolveTurn', () => {
  it('runs 40 turns deterministically with raids under way, finite and audited', () => {
    const run = () => { let s = world(); for (let i = 0; i < 40; i++) { s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; } return s; };
    const a = run(); const b = run();
    expect(a.indepStats).toEqual(b.indepStats);
    expect(a.indepStats.raidsStarted).toBeGreaterThan(0);
    expect(JSON.stringify(a.nations)).toBe(JSON.stringify(b.nations));
    expect(auditGameState(a)).toEqual([]);
    Object.values(a.nations).forEach((n) => { if (n.indep) expect(Number.isFinite(n.indep.gold || 0)).toBe(true); });
  }, 300000);
});
