import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import LensStrip, { lensListMaxHeight } from './LensStrip';
import { LENSES } from './lenses';

// plans/ui/fix-mobile, bug 2: on a phone held sideways the open lens list ran under the top bar and
// did not scroll, so Political could not be picked again.
describe('the lens strip on a phone', () => {
  it('fits the open list between its bottom and the top bar', () => {
    // 844x390: the list's bottom sits about 333 px down, the top bar is 36 px tall
    expect(lensListMaxHeight(333, 36)).toBe(289);
    // a short Safari screen still leaves a scrollable list, never a negative or tiny one
    expect(lensListMaxHeight(120, 36)).toBe(96);
  });

  it('offers a one-tap way back to Political whenever another lens is on', () => {
    const on = renderToStaticMarkup(React.createElement(LensStrip, { lens: 'supply', onChange: vi.fn() }));
    expect(on).toContain('data-testid="lens-political"');
    expect(on).toContain('Map lens: Supply');
    const off = renderToStaticMarkup(React.createElement(LensStrip, { lens: 'political', onChange: vi.fn() }));
    expect(off).not.toContain('data-testid="lens-political"');
  });

  it('keeps every lens in the list, Political first', () => {
    expect(LENSES[0].id).toBe('political');
    expect(LENSES.map((l) => l.id)).toEqual(['political', 'yields', 'loyalty', 'threat', 'supply', 'trade', 'settle']);
  });
});
