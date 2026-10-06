import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getTiles } from '../../data/geo/tiles';
import { ringsAround } from '../../engine/world/cities';
import { settleSiteModel } from './settleSiteModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;
const capital = base.regions[base.nations[me].capitalRegionId];

describe('the settle site card (W04)', () => {
  it('says why a site next to a city is blocked, with the distance and the rule', () => {
    const tiles = getTiles();
    const near = [...ringsAround(tiles, capital.tile, 2)].find(([t, d]) => d === 2 && tiles.land[t] && !base.world.tileOwner[t])?.[0];
    expect(near).toBeDefined();
    const m = settleSiteModel(base, near, 'bronze');
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(new RegExp(`^Too close to ${capital.name}: 2 tiles \\(\\d+ km\\), needs ${m.spacingRings}$`));
    expect(m.nearest).toMatchObject({ name: capital.name, mine: true });
    expect(m.lines.map((l) => l.id)).toContain('nearest');
  });

  it('gives a legal site its yields, claim and facts, and no reason', () => {
    const tiles = getTiles();
    const far = [...ringsAround(tiles, capital.tile, 8)].filter(([t, d]) => d >= 6 && tiles.land[t] && !base.world.tileOwner[t])
      .map(([t]) => t).find((t) => settleSiteModel(base, t, 'bronze')?.ok);
    expect(far).toBeDefined();
    const m = settleSiteModel(base, far, 'bronze');
    expect(m.reason).toBeNull();
    expect(m.claims).toBeGreaterThan(0);
    expect(m.yields).toEqual(expect.objectContaining({ food: expect.any(Number), production: expect.any(Number), gold: expect.any(Number) }));
    expect(m.spacingKm).toBe(306);
  });

  it('has nothing to say about the sea', () => {
    const tiles = getTiles();
    const sea = tiles.land.findIndex((v) => v === 0);
    expect(settleSiteModel(base, sea, 'bronze')).toBeNull();
  });
});
