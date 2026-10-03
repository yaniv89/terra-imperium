import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { drawLensLayer } from './lensLayer';
import { LENS_IDS } from '../map/lenses';
import { yieldLabels, loyaltyDiscs, supplyTints, supplyReach } from '../map/lenses';

// A context that counts what the layer asks it to draw.
const fakeCtx = () => {
  const calls = { fill: 0, stroke: 0, text: 0, arc: 0 };
  const noop = () => {};
  return { calls, ctx: { save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, setLineDash: noop,
    fill: () => calls.fill++, stroke: () => calls.stroke++, arc: () => calls.arc++, fillText: () => calls.text++, strokeText: noop } };
};
const projection = geoEquirectangular().fitSize([2048, 1024], { type: 'Sphere' });

describe('lenses on the globe', () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  it('the political lens paints nothing; every other lens paints from the same model as the flat map', () => {
    const { ctx, calls } = fakeCtx();
    expect(drawLensLayer(ctx, { state: s, lens: 'political', projection, width: 2048 })).toBe(0);
    expect(calls.fill + calls.stroke + calls.text).toBe(0);
    LENS_IDS.forEach((lens) => expect(() => drawLensLayer(fakeCtx().ctx, { state: s, lens, projection, width: 2048 })).not.toThrow());
    const y = fakeCtx(); expect(drawLensLayer(y.ctx, { state: s, lens: 'yields', projection, width: 2048 })).toBe(yieldLabels(s).length); expect(y.calls.text).toBe(yieldLabels(s).length);
    const l = fakeCtx(); expect(drawLensLayer(l.ctx, { state: s, lens: 'loyalty', projection, width: 2048 })).toBe(loyaltyDiscs(s).length); expect(l.calls.arc).toBe(loyaltyDiscs(s).length);
    const cap = s.regions[getNationCapital('fr')];
    const army = Object.values(s.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const field = { ...s, units: { ...s.units, [army.id]: { ...army, tile: cap.tiles.find((t) => t !== cap.tile) } } };
    const sup = fakeCtx(); expect(drawLensLayer(sup.ctx, { state: field, lens: 'supply', projection, width: 2048 })).toBe(supplyTints(field).length + supplyReach(field, { limit: 2500 }).length); expect(sup.calls.fill).toBeGreaterThan(0); // the line's reach and the armies' zones (plans/playtest-1.md P2.2)
  });
});
