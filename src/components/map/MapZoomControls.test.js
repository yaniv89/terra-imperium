import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import MapZoomControls from './MapZoomControls';

// Map HUD cleanup: the zoom column folds into one small button, so a phone's map keeps its height.
describe('the map zoom controls', () => {
  it('start folded: one 40 px toggle, no zoom buttons until it is tapped', () => {
    const html = renderToStaticMarkup(React.createElement(MapZoomControls, { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onReset: vi.fn() }));
    expect(html).toContain('aria-label="Map zoom controls"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('w-10 h-10');
    expect(html).not.toContain('aria-label="Zoom in"');
    expect(html).not.toContain('aria-label="Reset view"');
  });
});
