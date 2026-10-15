import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getTiles } from '../data/geo/tiles';
import { tileFacts, tileYields } from '../data/tileYields';
import { siteQuality, siteQualityParts, siteRatingOf, SITE_SCORE_MIN } from './settlers';

const state = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });

// The formula as it was before the parts existed (same order, same rounding).
const legacy = (tile) => {
  const tiles = getTiles(); const ts = state.world.tileState || {}; const owner = state.world.tileOwner || {};
  const facts = tileFacts(tiles, tile, ts[tile]);
  if (!facts.land) return -Infinity;
  const own = (t) => { const y = tileYields(tileFacts(tiles, t, ts[t])); return y.food * 1.2 + y.production + y.gold; };
  let s = own(tile);
  tiles.neighbors[tile].forEach((n) => { if (!owner[n]) s += own(n) * 0.5; });
  if (facts.resource) s += 3;
  if (facts.river) s += 2;
  if (facts.coastal) s += 1.5;
  return Math.round(s * 10) / 10;
};

describe('site quality parts', () => {
  it('siteQuality equals the old formula and the parts add up to it', () => {
    const tiles = getTiles();
    let n = 0;
    for (let t = 0; t < tiles.land.length && n < 4000; t += 7) {
      if (!tiles.land[t]) continue;
      n++;
      const q = siteQuality(state, t);
      expect(q).toBe(legacy(t));
      const p = siteQualityParts(state, t);
      expect(p.total).toBe(q);
      const sum = p.here + p.neighbours + p.resource + p.river + p.coast;
      expect(Math.abs(sum - q)).toBeLessThanOrEqual(0.2);
    }
    expect(n).toBeGreaterThan(500);
  });
  it('water has no quality', () => {
    const tiles = getTiles();
    const w = [...tiles.land].findIndex((v) => !v);
    expect(siteQuality(state, w)).toBe(-Infinity);
  });
});

describe('site rating words', () => {
  it('is poor under the good-site threshold, then fair, good, excellent against the best in reach', () => {
    expect(siteRatingOf(SITE_SCORE_MIN - 0.1, 20)).toBe('poor');
    expect(siteRatingOf(SITE_SCORE_MIN, 20)).toBe('fair');
    expect(siteRatingOf(SITE_SCORE_MIN + 8, 20)).toBe('good');
    expect(siteRatingOf(SITE_SCORE_MIN + 13, 20)).toBe('excellent');
    expect(siteRatingOf(20, 20)).toBe('excellent');
  });
  it('a thin map does not make a bare pass excellent', () => {
    expect(siteRatingOf(SITE_SCORE_MIN + 1, SITE_SCORE_MIN + 1)).toBe('fair');
    expect(siteRatingOf(SITE_SCORE_MIN + 1, null)).toBe('fair');
  });
});
