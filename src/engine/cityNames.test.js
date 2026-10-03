import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from '../data/geo/tiles';
import { pickCityName, generateCityName } from './cityNames';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

describe('city names (plan P5.1)', () => {
  it('takes a real name nearby, never "City N", and never a name in use', () => {
    const t = tiles.capitals.fr;
    expect(pickCityName({}, tiles, t, 'fr')).toBe(tiles.names[t]);
    const used = { a: { name: tiles.names[t] } };
    const second = pickCityName(used, tiles, t, 'fr');
    expect(second).not.toBe(tiles.names[t]);
    expect(second).not.toMatch(/^City \d+$/);
    expect(second.length).toBeGreaterThan(2);
  });
  it('makes a name in the founder\'s culture when no real name is free, deterministically', () => {
    const a = generateCityName('gr', 'x'); const b = generateCityName('gr', 'x'); const c = generateCityName('ru', 'x');
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Z][a-z]+$/);
    expect(a).not.toBe(c);
    // 500 founded cities over the whole land: no numbered name, no duplicate within one nation.
    const names = new Set(); let land = 0;
    for (let i = 0; i < tiles.count && land < 500; i += 31) { if (tiles.land[i] !== 1) continue; land++; const regions = Object.fromEntries([...names].map((n, k) => [`c${k}`, { name: n }])); const n = pickCityName(regions, tiles, i, 'fr'); expect(n).not.toMatch(/^City \d+$/); expect(names.has(n)).toBe(false); names.add(n); }
    expect(land).toBe(500);
  });
});
