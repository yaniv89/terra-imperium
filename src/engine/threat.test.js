// src/engine/threat.test.js
import { describe, it, expect } from 'vitest';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { threatOf, garrisonStrength, threatenedCities, besiegerStacksBeside, pillageTile, THREAT_RINGS, RAID_GOLD } from './threat';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 7 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);
const PL_ID = rivalOf(PEOPLES_WORLD, 1);

const S = neighbourWorld({ seed: 7 });
const unit = (id, ownerId, tile, regionId, strength = 1000) => ({ id, ownerId, tile, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength, maxStrength: strength, morale: 100, movesLeft: 1 });

describe('threats, relief and raids', () => {
  const tiles = getTiles();
  const cap = S.regions[getNationCapital(DE_ID)];
  const rings = ringsAround(tiles, cap.tile, THREAT_RINGS + 2);
  const at = (d) => [...rings].find(([, r]) => r === d)[0];

  it('threat counts enemy land strength within THREAT_RINGS and no further; a weak garrison makes the city threatened', () => {
    const enemies = new Set([FR_ID]);
    const near = { ...S, units: { a: unit('a', FR_ID, at(3), getNationCapital(FR_ID), 2000), b: unit('b', FR_ID, at(THREAT_RINGS + 2), getNationCapital(FR_ID), 5000), g: unit('g', DE_ID, cap.tile, cap.id, 1000) } };
    expect(threatOf(near, cap, enemies)).toBe(2000);
    expect(garrisonStrength(near, DE_ID, cap)).toBe(1000);
    expect(threatenedCities(near, DE_ID, enemies)).toContain(cap.id);
    const safe = { ...near, units: { ...near.units, g: { ...near.units.g, strength: 5000 } } };
    expect(threatenedCities(safe, DE_ID, enemies)).not.toContain(cap.id);
    const besieged = { ...safe, regions: { ...safe.regions, [cap.id]: { ...cap, siege: { by: FR_ID, hp: 10, maxHp: 100 } } } };
    expect(threatenedCities(besieged, DE_ID, enemies)).toContain(cap.id);
  });

  it('besieger stacks beside a relief army are listed weakest first', () => {
    const ring1 = tiles.neighbors[cap.tile];
    const [b1, b2] = ring1;
    const outside = tiles.neighbors[b1].find((t) => !ring1.includes(t) && t !== cap.tile && tiles.land[t] === 1 && tiles.neighbors[t].includes(b2)) ?? tiles.neighbors[b1].find((t) => !ring1.includes(t) && t !== cap.tile && tiles.land[t] === 1);
    const s = { ...S, regions: { ...S.regions, [cap.id]: { ...cap, siege: { by: FR_ID, hp: 10, maxHp: 100 } } }, units: { x: unit('x', FR_ID, b1, getNationCapital(FR_ID), 3000), y: unit('y', FR_ID, b2, getNationCapital(FR_ID), 1000) } };
    const list = besiegerStacksBeside(s, outside, s.regions[cap.id]);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((x, i, a) => i === 0 || a[i - 1].strength <= x.strength)).toBe(true);
    expect(list[0].tile === b1 || list[0].tile === b2).toBe(true);
  });

  it('a raid pillages an enemy improvement once and pays RAID_GOLD', () => {
    const farm = cap.tiles.find((t) => t !== cap.tile);
    const s = { ...S, world: { ...S.world, tileState: { ...S.world.tileState, [farm]: { improvement: 'farm' } } } };
    const r = pillageTile(s, FR_ID, farm, new Set([DE_ID]));
    expect(r.gold).toBe(RAID_GOLD);
    expect(r.tileState[farm].pillaged).toBe(true);
    expect(r.cityId).toBe(cap.id);
    expect(pillageTile({ ...s, world: { ...s.world, tileState: r.tileState } }, FR_ID, farm, new Set([DE_ID]))).toBeNull();
    expect(pillageTile(s, FR_ID, farm, new Set([PL_ID]))).toBeNull(); // not an enemy's land
  });
});
