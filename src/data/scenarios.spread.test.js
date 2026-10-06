// src/data/scenarios.spread.test.js
// Start capitals obey the settling rule (plans/settle-rules.md R1, R3, R4 option A, R5):
// scenarios.js spreadCapitals and buildScenarioStarts.
import { describe, it, expect } from 'vitest';
import { getTiles } from './geo/tiles';
import { ringsForKm } from './geo/gridScale';
import { spacingBreaches } from './geo/citySpacing';
import { spreadCapitals, absentAtStart, buildScenarioStarts, spacedApart, startPlacementNote, START_ABROAD_KM, SCENARIO_IDS } from './scenarios';

describe('start capitals', () => {
  const tiles = getTiles();
  const ids = Object.keys(tiles.capitals).filter((id) => tiles.capitals[id] != null);
  const out = spreadCapitals(tiles, ids);
  const absent = absentAtStart(tiles, ids);
  // rings from a nation's own land to `tile` (0 inside it), up to `max`
  const ringsBeyond = (id, tile, max) => {
    const own = tiles.countryTiles[id] || [];
    const dist = new Map(own.map((t) => [t, 0]));
    const queue = [...own];
    for (let i = 0; i < queue.length; i++) {
      const d = dist.get(queue[i]);
      if (d >= max) continue;
      tiles.neighbors[queue[i]].forEach((n) => { if (!dist.has(n)) { dist.set(n, d + 1); queue.push(n); } });
    }
    return dist.get(tile) ?? Infinity;
  };

  it('every pair of start capitals obeys the settling rule', () => {
    expect(spacingBreaches(tiles, Object.values(out))).toEqual([]);
  });

  it('the big lands keep their real capitals; a moved capital stays within START_ABROAD_KM of its land', () => {
    ['fr', 'de', 'cn', 'us', 'ru', 'eg', 'il', 'gb', 'in', 'br'].forEach((id) => expect(out[id], id).toBe(tiles.capitals[id]));
    const moved = ids.filter((id) => out[id] != null && out[id] !== tiles.capitals[id]);
    expect(moved.length).toBeGreaterThan(5);
    const reach = ringsForKm(START_ABROAD_KM, { tiles });
    moved.forEach((id) => expect(ringsBeyond(id, out[id], reach), id).toBeLessThanOrEqual(reach));
  });

  it('a nation with no room is absent, and only small lands are', () => {
    expect(absent).toContain('ps'); // Ramallah beside Jerusalem
    expect(absent.length).toBeLessThan(30);
    absent.forEach((id) => expect((tiles.countryTiles[id] || []).length, id).toBeLessThanOrEqual(12));
  });

  it('the picked nation keeps its real capital and the rule still holds', () => {
    ['ps', ...absent.slice(0, 6)].forEach((p) => {
      const picked = spreadCapitals(tiles, ids, { priority: p });
      expect(picked[p], p).toBe(tiles.capitals[p]);
      expect(spacingBreaches(tiles, Object.values(picked)), p).toEqual([]);
    });
    const asPalestine = spreadCapitals(tiles, ids, { priority: 'ps' });
    if (asPalestine.il != null) expect(spacedApart(tiles, asPalestine.il, asPalestine.ps)).toBe(true);
  }, 60000);

  it('every absent nation starts on its real capital when picked', () => {
    absent.forEach((p) => {
      const { starts, absent: gone } = buildScenarioStarts(tiles, 'dawn', null, { priority: p });
      expect(starts[p]?.capital, p).toBe(tiles.capitals[p]);
      expect(gone).not.toContain(p);
    });
  }, 120000);

  it('is the same every time, in any input order', () => {
    expect(spreadCapitals(tiles, [...ids].reverse())).toEqual(out);
    expect(spreadCapitals(tiles, [...ids].reverse(), { priority: 'ps' })).toEqual(spreadCapitals(tiles, ids, { priority: 'ps' }));
  });

  it('every start city of every scenario obeys the rule, extra cities included', () => {
    SCENARIO_IDS.forEach((sid) => {
      const { starts } = buildScenarioStarts(tiles, sid);
      const centres = Object.values(starts).flatMap((s) => s.cities.map((c) => c.tile));
      expect(spacingBreaches(tiles, centres), sid).toEqual([]);
    });
  }, 60000);

  it('a moved capital keeps its real name', () => {
    const { starts } = buildScenarioStarts(tiles, 'dawn');
    const moved = ids.filter((id) => starts[id] && starts[id].capital !== tiles.capitals[id] && tiles.names[tiles.capitals[id]]);
    expect(moved.length).toBeGreaterThan(0);
    moved.forEach((id) => expect(starts[id].cities[0].name, id).toBe(tiles.names[tiles.capitals[id]]));
    expect(starts.fr.cities[0].name).toBeUndefined(); // unmoved: the tile's own name
  });

  it('the nation picker notes a crowded start', () => {
    expect(startPlacementNote(tiles, 'fr')).toBeNull();
    expect(startPlacementNote(tiles, 'ps')).toMatch(/not on the map/);
    const moved = ids.find((id) => out[id] != null && out[id] !== tiles.capitals[id]);
    expect(startPlacementNote(tiles, moved)).toMatch(/starts at/);
  });
});
