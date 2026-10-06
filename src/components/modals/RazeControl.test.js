// Phase W3: keep or raze a city taken by force (RazeControl in the city card, razing.js).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import RazeControl from './RazeControl';
import { createInitialState } from '../../engine/gameReducer';

const state = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });

describe('RazeControl (phase W3)', () => {
  it('a city taken by force offers a 44 px raze button; a burning one shows the fire and a stop button', () => {
    const ind = Object.values(state.nations).find((n) => n.indep?.personality === 'tribal');
    const city = { ...state.regions[ind.capitalRegionId], owner: 'akkad', conquest: { from: ind.id, turn: 1, warId: null }, isCapital: false };
    const s = { ...state, regions: { ...state.regions, [city.id]: city } };
    const html = renderToStaticMarkup(React.createElement(RazeControl, { state: s, dispatch: vi.fn(), city }));
    expect(html).toContain('data-testid="raze-city"');
    expect(html).toContain('min-h-[44px]');
    const burning = { ...city, razing: { by: 'akkad', startedTurn: 1 } };
    const fire = renderToStaticMarkup(React.createElement(RazeControl, { state: s, dispatch: vi.fn(), city: burning }));
    expect(fire).toContain('data-testid="stop-razing"');
    // A city never taken by force has no control.
    expect(renderToStaticMarkup(React.createElement(RazeControl, { state, dispatch: vi.fn(), city: state.regions[state.nations.akkad.capitalRegionId] }))).toBe('');
  });
});
