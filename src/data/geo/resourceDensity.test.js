// src/data/geo/resourceDensity.test.js (playtest audit I098)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { RESOURCES_ON_TILES } from '../tileYields';
import {
  RESOURCE_KINDS, RESOURCE_DENSITY_VERSION, thinResources, resourceShares, startTilesOf,
  SAME_RESOURCE_RINGS, START_MIN_RESOURCES
} from './resourceDensity';
import { getTiles } from './tiles';

const json = JSON.parse(readFileSync('src/data/geo/tiles.json', 'utf8'));
const peoples = JSON.parse(readFileSync('src/data/geo/peopleCapitals.json', 'utf8'));
const deposits = JSON.parse(readFileSync('src/data/geo/deposits.json', 'utf8'));

const ring = (t, rings) => {
  const tiles = getTiles();
  const seen = new Set([t]); let front = [t];
  for (let r = 0; r < rings; r++) { const next = []; front.forEach((x) => tiles.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); next.push(y); } })); front = next; }
  return seen;
};

describe('resource density (I098)', () => {
  it('knows the kind of every resource as tileYields.js does', () => {
    Object.entries(RESOURCES_ON_TILES).forEach(([id, r]) => expect(RESOURCE_KINDS[id], id).toBe(r.kind));
    expect(Object.keys(RESOURCE_KINDS).sort()).toEqual(Object.keys(RESOURCES_ON_TILES).sort());
  });

  it('the shipped grid is thinned: about 18% of the land, bonus cut hardest, every resource still on the map', () => {
    expect(json.resourceDensity).toBe(RESOURCE_DENSITY_VERSION);
    const s = resourceShares(json);
    expect(s.all).toBeGreaterThan(0.16);
    expect(s.all).toBeLessThan(0.2);
    expect(s.bonus).toBeLessThan(s.luxury);
    expect(s.luxury).toBeGreaterThan(0.05);
    expect(s.strategic).toBeGreaterThan(0.05);
    const present = new Set(json.resource.filter((r) => r >= 0));
    expect(present.size).toBe(json.resourceNames.length);
  });

  it('keeps the curated deposits and a resource in every people\'s founding area', () => {
    const tiles = getTiles();
    Object.entries(deposits).forEach(([cid, list]) => list.forEach((res) => {
      if (!tiles.countryTiles[cid]) return;
      expect(tiles.countryTiles[cid].some((i) => tiles.resourceOf(i) === res), `${cid} ${res}`).toBe(true);
    }));
    // Every start keeps something within its border reach.
    Object.values(peoples.capitals).forEach((c) => expect([...ring(c, 3)].some((t) => tiles.resourceOf(t)), `start ${c}`).toBe(true));
  });

  it('thins deterministically, spaces duplicates and protects starts (on a synthetic strip)', () => {
    // A strip of 60 land tiles, each with the same bonus resource; neighbours left and right.
    const n = 60;
    const neighbors = []; for (let i = 0; i < n; i++) neighbors.push(i - 1 >= 0 ? i - 1 : -1, i + 1 < n ? i + 1 : -1, -1, -1, -1, -1);
    const raw = { count: n, land: new Array(n).fill(1), resource: new Array(n).fill(0), resourceNames: ['wheat'], neighbors, country: new Array(n).fill(-1), countryIds: [] };
    const a = thinResources(raw, {}, []);
    expect(thinResources(raw, {}, [])).toEqual(a);
    expect(raw.resource.every((r) => r === 0)).toBe(true); // the input is untouched
    const kept = a.map((r, i) => (r >= 0 ? i : -1)).filter((i) => i >= 0);
    expect(kept.length).toBeLessThan(n / 2);
    expect(kept.length).toBeGreaterThan(0);
    // Every tile still has one within two steps (the cover floor).
    for (let i = 0; i < n; i++) expect(kept.some((k) => Math.abs(k - i) <= 2), `tile ${i}`).toBe(true);
    // A start keeps START_MIN_RESOURCES in its founding area.
    const s = thinResources(raw, {}, [30]);
    expect([29, 30, 31].filter((t) => s[t] >= 0).length).toBeGreaterThanOrEqual(Math.min(START_MIN_RESOURCES, 3));
    expect(SAME_RESOURCE_RINGS).toBeGreaterThan(0);
  });

  it('lists the old capitals and the peoples\' capitals as starts', () => {
    const starts = startTilesOf(json, peoples);
    expect(starts.length).toBeGreaterThan(200);
    expect(starts).toContain(peoples.capitals.akkad);
  });
});
