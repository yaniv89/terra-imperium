import { describe, it, expect } from 'vitest';
import { declutterLabels, labelBox, cityLabelPrio } from './declutter';

const label = (id, x, y, prio, w = 60, h = 14) => ({ id, anchor: [x, y], offset: [0, 0, 0, 0], size: [w, h], exp: [0, 0], prio });

describe('map labels do not pile up (I080)', () => {
  it('keeps the higher priority of two overlapping labels, and both when they are apart', () => {
    const a = label('a', 100, 100, 1); const b = label('b', 110, 104, 5); const c = label('c', 400, 100, 0);
    expect(declutterLabels([a, b, c], 1).map((s) => s.id)).toEqual(['b', 'c']);
    // zoomed in, the anchors move apart and both fit
    expect(declutterLabels([a, b, c], 8).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('the earlier label wins a tie, and the first order is kept', () => {
    const a = label('a', 0, 0, 2); const b = label('b', 5, 0, 2); const c = label('c', 300, 0, 9);
    expect(declutterLabels([a, b, c], 1).map((s) => s.id)).toEqual(['a', 'c']);
  });
  it('reads the offset and the zoom exponents of a sprite', () => {
    const s = { anchor: [10, 10], offset: [0, -4, 0, -2], size: [20, 10], exp: [0, 0.5] };
    expect(labelBox(s, 4, 0)).toEqual([30, 27, 50, 37]);
  });
  it('ranks the selected city, then your cities, then capitals, then size', () => {
    const big = { size: 12 }; const cap = { size: 3, isCapital: true };
    expect(cityLabelPrio(cap)).toBeGreaterThan(cityLabelPrio(big));
    expect(cityLabelPrio(big, { own: true })).toBeGreaterThan(cityLabelPrio(cap));
    expect(cityLabelPrio({ size: 1 }, { selected: true })).toBeGreaterThan(cityLabelPrio(cap, { own: true }));
  });
});
