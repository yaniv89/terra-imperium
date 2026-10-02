import { describe, it, expect } from 'vitest';
import { ICONS } from './LensStrip';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { LENSES, LENS_IDS, yieldLabels, loyaltyDiscs, loyaltyColour, threatStacks, supplyTints, ZONE_COLOUR } from './lenses';

describe('lenses', () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  it('seven lenses with keys 1 to 7', () => {
    expect(LENS_IDS).toEqual(['political', 'yields', 'loyalty', 'threat', 'supply', 'estates', 'trade']);
    expect(LENSES.map((l) => l.key)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    LENSES.forEach((l) => expect(ICONS[l.id], l.id).toBeTruthy()); // the strip needs an icon per lens
  });
  it('yields on the player\'s tiles, loyalty discs per city, supply tints per own army, threat circles per enemy stack', () => {
    const cap = S.regions[getNationCapital('fr')];
    const y = yieldLabels(S);
    expect(y.length).toBe(Object.values(S.regions).filter((c) => c.owner === 'fr').reduce((n, c) => n + c.tiles.length, 0));
    expect(y.find((r) => r.tile === cap.tile).worked).toBe(true);
    const d = loyaltyDiscs(S);
    expect(d.length).toBe(Object.values(S.regions).filter((c) => c.owner).length);
    expect(loyaltyColour(100)).toBe('hsl(120 80% 45%)');
    expect(loyaltyColour(0)).toBe('hsl(0 80% 45%)');
    const tints = supplyTints(S);
    expect(tints.length).toBeGreaterThan(0);
    expect(tints[0].colour).toBe(ZONE_COLOUR.home);
    expect(threatStacks(S)).toEqual([]);
    const de = getNationCapital('de');
    const war = { ...S, wars: [{ id: 'w', active: true, aggressor: 'de', enemy: 'fr' }] };
    const t = threatStacks(war);
    const deStacks = Object.values(S.units).filter((u) => u.ownerId === 'de' && u.domain === 'land');
    expect(t.length).toBeGreaterThan(0);
    expect(t.some((x) => x.tile === S.regions[de].tile)).toBe(deStacks.some((u) => u.regionId === de));
    t.forEach((x) => expect(x.edgeTile).not.toBe(x.tile));
  });
});
