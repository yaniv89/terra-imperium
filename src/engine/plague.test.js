import { describe, it, expect } from 'vitest';
import { sirStep, jumpChance, betaOf, linkWeight, seedPlague, spreadPlague, seedPlagueNear, BETA, MORTALITY, MIN_I, REACH_KM, LAND_KM, VISIBLE_I, BETA_TECHS, PLAGUE_EVENT_ORIGINS } from './plague';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { sizeToPeople } from './world/cities';

describe('the SIR generation inside a city', () => {
  it('an outbreak grows, peaks as the susceptible run out, and burns out with most people immune', () => {
    let p = { i: 0.08, r: 0 }; let peak = 0; let turns = 0; let attack = 0;
    while (p.i > 0 && turns < 60) {
      attack += p.i;
      const s = sirStep(p, 2.4);
      p = { i: s.i < MIN_I ? 0 : s.i, r: s.r + (s.i < MIN_I ? s.i : 0) };
      peak = Math.max(peak, p.i); turns += 1;
    }
    expect(peak).toBeGreaterThan(0.08);
    expect(turns).toBeLessThan(20);
    expect(attack).toBeGreaterThan(0.5);
    expect(attack).toBeLessThan(1);
  });
  it('the dead and the recovered both leave the susceptible; deaths are MORTALITY of the infected', () => {
    const s = sirStep({ i: 0.2, r: 0.1 }, 2);
    expect(s.deathsShare).toBeCloseTo(MORTALITY * 0.2, 10);
    expect(s.r).toBeGreaterThan(0.29);
    expect(s.i + s.r).toBeLessThanOrEqual(1);
  });
  it('a below-one beta (sanitation, medicine) makes outbreaks fizzle', () => {
    expect(sirStep({ i: 0.05, r: 0 }, 0.7).i).toBeLessThan(0.05);
  });
});

describe('transmission between cities', () => {
  it('falls with km and is 0 past the reach; ports also share a longer sea lane', () => {
    expect(linkWeight(0, false)).toBe(1);
    expect(linkWeight(LAND_KM, false)).toBeCloseTo(0.5, 10);
    expect(linkWeight(REACH_KM + 1, false)).toBe(0);
    expect(linkWeight(REACH_KM + 1, true)).toBeGreaterThan(0);
  });
  it('the jump chance grows with pressure, stays below 1, and immunity blocks it', () => {
    expect(jumpChance(0)).toBe(0);
    expect(jumpChance(2)).toBeGreaterThan(jumpChance(1));
    expect(jumpChance(1e6)).toBeLessThan(1);
    expect(jumpChance(1, 1)).toBe(0);
  });
  it('crowding raises beta; Aqueducts, the Scientific Method and Genomics lower it', () => {
    expect(betaOf({ size: 10 })).toBeGreaterThan(betaOf({ size: 2 }));
    expect(betaOf({ size: 6 })).toBeCloseTo(BETA, 10);
    expect(betaOf({ size: 6 }, Object.keys(BETA_TECHS))).toBeLessThan(1);
  });
});

describe('spreadPlague on real tiles', () => {
  const tiles = getTiles();
  // A row of cities 1, 2, 3 ... hexes east of a land tile, each with its own owner.
  const build = () => {
    let t = tiles.countryTiles.fr[0];
    const regions = {};
    for (let k = 0; k < 6; k++) {
      regions[`c${k}`] = { id: `c${k}`, name: `C${k}`, owner: `n${k}`, tile: t, size: 6, food: 0, currentPopulation: sizeToPeople(6) };
      t = tiles.neighbors[tiles.neighbors[t][0]][0];
    }
    return regions;
  };
  it('does nothing and keeps the objects when nothing is infected (a quiet turn)', () => {
    const regions = build(); const before = { ...regions };
    const logs = spreadPlague(regions, 7);
    Object.keys(before).forEach((id) => expect(regions[id] === before[id] || regions[id].plague?.since === 7).toBe(true));
    expect(logs.every((l) => /breaks out/.test(l.message))).toBe(true);
  });
  it('an outbreak spreads to nearby cities, kills people, marks the city and burns out; same result every run', () => {
    const run = (start) => {
      const regions = build();
      regions.c0 = seedPlague(regions.c0, start, 0.3);
      const reached = new Set(); let marked = false; let lastTurn = 0;
      for (let t = start + 1; t < start + 80; t++) {
        spreadPlague(regions, t);
        Object.values(regions).forEach((c) => { if (c.plague?.i > 0) { reached.add(c.id); lastTurn = t; } if (c.disaster?.kind === 'plague') marked = true; c.currentPopulation = sizeToPeople(c.size); });
      }
      return { reached: [...reached].sort(), lastTurn: lastTurn - start, marked, sizes: Object.values(regions).map((c) => c.size), food: Object.values(regions).map((c) => c.food) };
    };
    // Jumps are seeded rolls: over a few outbreaks at least one reaches a neighbour.
    const runs = [0, 100, 200, 300, 400, 500, 600, 700].map(run);
    expect(runs.some((r) => r.reached.length > 1)).toBe(true);
    runs.forEach((r) => {
      expect(r.marked).toBe(true);
      expect(r.lastTurn).toBeLessThan(79);
      expect(r.sizes[0] < 6 || r.food[0] === 0).toBe(true);
    });
    expect(run(300)).toEqual(runs[3]);
  });
  it('a city far beyond every kernel is never reached by land', () => {
    const regions = build();
    const far = tiles.countryTiles.au[0];
    expect(distanceKm(tiles.centres[far], tiles.centres[regions.c0.tile])).toBeGreaterThan(10000);
    regions.far = { id: 'far', name: 'Far', owner: 'au', tile: far, size: 6, food: 0, currentPopulation: sizeToPeople(6) };
    regions.c0 = seedPlague(regions.c0, 1, 0.5);
    for (let t = 2; t < 40; t++) spreadPlague(regions, t);
    expect(regions.far.plague).toBeFalsy();
  });
  it('an army carries it home from where it stands', () => {
    const far = tiles.countryTiles.au[0];
    const reachedFrom = (start) => {
      const regions = build();
      regions.far = { id: 'far', name: 'Far', owner: 'au', tile: far, size: 6, food: 0, currentPopulation: sizeToPeople(6) };
      regions.c0 = seedPlague(regions.c0, start, 0.3);
      const units = { u: { id: 'u', ownerId: 'au', domain: 'land', strength: 1000, tile: regions.c0.tile, homeRegionId: 'far' } };
      const tileOwner = { [regions.c0.tile]: 'c0' };
      for (let t = start + 1; t < start + 40; t++) { spreadPlague(regions, t, { units, tileOwner }); if (regions.far.plague?.i > 0) return true; }
      return false;
    };
    expect([0, 100, 200, 300, 400, 500].some(reachedFrom)).toBe(true);
  });
  it('the scripted Black Death seeds the cities nearest the Black Sea steppe', () => {
    const regions = build();
    const crimea = tiles.countryTiles.ua.find((t) => Math.abs(tiles.latLonOf(t).lat - 45) < 1.5);
    regions.k = { id: 'k', name: 'Kaffa', owner: 'ua', tile: crimea, size: 4, food: 0 };
    const seeded = seedPlagueNear(regions, PLAGUE_EVENT_ORIGINS.black_death, 5);
    expect(seeded[0]).toBe('k');
    expect(regions.k.plague.i).toBeGreaterThanOrEqual(VISIBLE_I);
  });
});

describe('outbreaks differ between games', () => {
  it('the spontaneous seed rolls depend on the game seed', () => {
    const tiles = getTiles();
    const make = () => { const r = {}; tiles.countryTiles.fr.slice(0, 400).filter((_, k) => k % 4 === 0).forEach((t, k) => { r[`x${k}`] = { id: `x${k}`, name: `X${k}`, owner: 'fr', tile: t, size: 8, food: 0, currentPopulation: sizeToPeople(8) }; }); return r; };
    const firstOutbreak = (seed) => { for (let t = 1; t < 3000; t++) { const r = make(); spreadPlague(r, t, { seed }); const hit = Object.keys(r).find((id) => r[id].plague?.i > 0); if (hit) return `${t}:${hit}`; } return null; };
    expect(firstOutbreak(1)).not.toBe(firstOutbreak(2));
  });
});

describe('plague through resolveTurn', () => {
  it('a seeded outbreak runs its course in the turn, the same way every time', async () => {
    const { createInitialState } = await import('../context/GameContext');
    const { resolveTurn } = await import('./resolveTurn');
    const { HISTORICAL_EVENTS } = await import('../data/events');
    const firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
    const base = { ...createInitialState({ playerNationId: 'au', rngSeed: 21 }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const id = Object.keys(base.regions).find((k) => base.regions[k].owner === 'fr');
    const start = { ...base, regions: { ...base.regions, [id]: seedPlague(base.regions[id], base.turnNumber, 0.3) } };
    const run = () => { let s = start; for (let t = 0; t < 3; t++) s = resolveTurn(s); return s; };
    const a = run();
    expect(a.regions[id].plague).toBeTruthy();
    expect(a.regions[id].plague.r).toBeGreaterThan(0);
    expect(JSON.stringify(run().regions)).toBe(JSON.stringify(a.regions));
  }, 60000);
});
