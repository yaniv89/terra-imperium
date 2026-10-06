import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from './geo/tiles';
import { buildScenarioStarts, landClaimedShare, SCENARIO_IDS, ringsFrom, spreadCapitals } from './scenarios';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

describe('scenario starts on the world grid', () => {
  it('Dawn: every nation has one city on its (spread) capital tile and claims about 10% of the land', () => {
    const { starts, claimedBy } = buildScenarioStarts(tiles, 'dawn');
    expect(Object.keys(starts).length).toBe(240);
    const capitals = spreadCapitals(tiles, Object.keys(starts));
    Object.entries(starts).forEach(([id, s]) => {
      expect(s.cities.length, id).toBe(1);
      expect(s.capital).toBe(capitals[id]);
      expect(s.tiles[0]).toBe(s.capital);
      expect(s.tiles.length, id).toBeGreaterThanOrEqual(1);
      s.tiles.forEach((t) => expect(claimedBy.get(t)).toBe(id));
    });
    const share = landClaimedShare(tiles, claimedBy);
    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.12);
    expect(starts.eg.size).toBe(5);
    expect(starts.eg.settlers).toBe(1);
    expect(starts.fr.size).toBe(2);
    expect(starts.fr.settlers).toBe(0);
    expect(starts.is.hardStart).toBe(true);
    expect(starts.is.size).toBe(1);
  });

  it('never claims a tile twice and never claims water', () => {
    SCENARIO_IDS.forEach((sid) => {
      const { starts, claimedBy } = buildScenarioStarts(tiles, sid);
      const all = Object.values(starts).flatMap((s) => s.tiles);
      expect(new Set(all).size, sid).toBe(all.length);
      expect(all.length).toBe(claimedBy.size);
      all.forEach((t) => expect(tiles.land[t], `${sid} tile ${t}`).toBe(1));
    });
  });

  it('later starts claim more land and more cities, the Modern start every tile', () => {
    const shares = SCENARIO_IDS.map((sid) => landClaimedShare(tiles, buildScenarioStarts(tiles, sid).claimedBy));
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThan(shares[i - 1]);
    const modern = buildScenarioStarts(tiles, 'modern');
    const landWithCountry = tiles.land.reduce((a, l, i) => a + (l && tiles.country[i] >= 0 ? 1 : 0), 0);
    expect(modern.claimedBy.size).toBe(landWithCountry);
    expect(modern.starts.fr.cities.length).toBeGreaterThan(3);
    const kingdoms = buildScenarioStarts(tiles, 'kingdoms');
    expect(kingdoms.starts.fr.cities.length).toBe(3);
    // Cities are at least 3 tiles apart.
    kingdoms.starts.fr.cities.forEach((a) => kingdoms.starts.fr.cities.forEach((b) => {
      if (a.tile !== b.tile) expect(ringsFrom(tiles, a.tile, 2).has(b.tile)).toBe(false);
    }));
  }, 30000); // builds every scenario start on the 100k-cell grid: slow under load

  it('is deterministic', () => {
    const a = buildScenarioStarts(tiles, 'classical');
    const b = buildScenarioStarts(tiles, 'classical');
    expect(JSON.stringify(a.starts)).toBe(JSON.stringify(b.starts));
  });
});
