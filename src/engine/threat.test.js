// src/engine/threat.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { threatOf, garrisonStrength, threatenedCities, besiegerStacksBeside, pillageTile, THREAT_RINGS, RAID_GOLD } from './threat';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
const unit = (id, ownerId, tile, regionId, strength = 1000) => ({ id, ownerId, tile, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength, maxStrength: strength, morale: 100, movesLeft: 1 });

describe('threats, relief and raids', () => {
  const tiles = getTiles();
  const cap = S.regions[getNationCapital('de')];
  const rings = ringsAround(tiles, cap.tile, THREAT_RINGS + 2);
  const at = (d) => [...rings].find(([, r]) => r === d)[0];

  it('threat counts enemy land strength within THREAT_RINGS and no further; a weak garrison makes the city threatened', () => {
    const enemies = new Set(['fr']);
    const near = { ...S, units: { a: unit('a', 'fr', at(3), getNationCapital('fr'), 2000), b: unit('b', 'fr', at(THREAT_RINGS + 2), getNationCapital('fr'), 5000), g: unit('g', 'de', cap.tile, cap.id, 1000) } };
    expect(threatOf(near, cap, enemies)).toBe(2000);
    expect(garrisonStrength(near, 'de', cap)).toBe(1000);
    expect(threatenedCities(near, 'de', enemies)).toContain(cap.id);
    const safe = { ...near, units: { ...near.units, g: { ...near.units.g, strength: 5000 } } };
    expect(threatenedCities(safe, 'de', enemies)).not.toContain(cap.id);
    const besieged = { ...safe, regions: { ...safe.regions, [cap.id]: { ...cap, siege: { by: 'fr', hp: 10, maxHp: 100 } } } };
    expect(threatenedCities(besieged, 'de', enemies)).toContain(cap.id);
  });

  it('besieger stacks beside a relief army are listed weakest first', () => {
    const ring1 = tiles.neighbors[cap.tile];
    const [b1, b2] = ring1;
    const outside = tiles.neighbors[b1].find((t) => !ring1.includes(t) && t !== cap.tile && tiles.land[t] === 1 && tiles.neighbors[t].includes(b2)) ?? tiles.neighbors[b1].find((t) => !ring1.includes(t) && t !== cap.tile && tiles.land[t] === 1);
    const s = { ...S, regions: { ...S.regions, [cap.id]: { ...cap, siege: { by: 'fr', hp: 10, maxHp: 100 } } }, units: { x: unit('x', 'fr', b1, getNationCapital('fr'), 3000), y: unit('y', 'fr', b2, getNationCapital('fr'), 1000) } };
    const list = besiegerStacksBeside(s, outside, s.regions[cap.id]);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((x, i, a) => i === 0 || a[i - 1].strength <= x.strength)).toBe(true);
    expect(list[0].tile === b1 || list[0].tile === b2).toBe(true);
  });

  it('a raid pillages an enemy improvement once and pays RAID_GOLD', () => {
    const farm = cap.tiles.find((t) => t !== cap.tile);
    const s = { ...S, world: { ...S.world, tileState: { ...S.world.tileState, [farm]: { improvement: 'farm' } } } };
    const r = pillageTile(s, 'fr', farm, new Set(['de']));
    expect(r.gold).toBe(RAID_GOLD);
    expect(r.tileState[farm].pillaged).toBe(true);
    expect(r.cityId).toBe(cap.id);
    expect(pillageTile({ ...s, world: { ...s.world, tileState: r.tileState } }, 'fr', farm, new Set(['de']))).toBeNull();
    expect(pillageTile(s, 'fr', farm, new Set(['pl']))).toBeNull(); // not an enemy's land
  });
});
