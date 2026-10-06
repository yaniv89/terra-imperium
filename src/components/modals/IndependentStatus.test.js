// Phase W2 placeholder UI: an independent's status and mercenary market in the city panel.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import IndependentStatus from './IndependentStatus';
import RazeControl from './RazeControl';
import { createInitialState } from '../../engine/gameReducer';
import { mercOffer } from '../../engine/mercenaries';
import { withGrudge } from '../../engine/grudges';
import { startTribute } from '../../engine/raids';

const state = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const seller = Object.values(state.nations).find((n) => ['mercantile', 'raiders'].includes(n.indep?.personality) && mercOffer(state, n.id, 'akkad').ok);

describe('IndependentStatus (phase W2)', () => {
  it('shows the grudge, tribute and a 44 px hire button priced by the offer', () => {
    const offer = mercOffer(state, seller.id, 'akkad');
    const rich = { ...state, resources: { ...state.resources, gold: 1000 }, nations: startTribute({ ...state.nations, [seller.id]: withGrudge(seller, 'akkad', 30) }, seller.id, 'akkad', 4, state.turnNumber) };
    const html = renderToStaticMarkup(React.createElement(IndependentStatus, { state: rich, dispatch: vi.fn(), nation: rich.nations[seller.id] }));
    expect(html).toContain('30 / 100');
    expect(html).toContain('You pay them 4 gold a turn');
    expect(html).toContain('data-testid="hire-mercenary"');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain(`Hire a band (${offer.price} gold)`);
  });

  it('a tribal city sells no mercenaries', () => {
    const tribal = Object.values(state.nations).find((n) => n.indep?.personality === 'tribal');
    const html = renderToStaticMarkup(React.createElement(IndependentStatus, { state, dispatch: vi.fn(), nation: tribal }));
    expect(html).not.toContain('hire-mercenary');
  });
});

describe('IndependentStatus and RazeControl (phase W3)', () => {
  it('shows the attitude and the 44 px gift, join and tribute buttons; a fortress offers no joining', () => {
    const tribal = Object.values(state.nations).find((n) => n.indep?.personality === 'tribal');
    const html = renderToStaticMarkup(React.createElement(IndependentStatus, { state: { ...state, resources: { ...state.resources, gold: 1000 } }, dispatch: vi.fn(), nation: tribal }));
    expect(html).toContain('data-testid="independent-attitude"');
    expect(html).toContain('data-testid="gift-independent"');
    expect(html).toContain('data-testid="propose-joining"');
    expect(html).toContain('data-testid="demand-tribute"');
    expect(html).not.toContain('propose-trade');
    const fort = Object.values(state.nations).find((n) => n.indep?.personality === 'fortress');
    const fortHtml = renderToStaticMarkup(React.createElement(IndependentStatus, { state, dispatch: vi.fn(), nation: fort }));
    expect(fortHtml).not.toContain('propose-joining');
    expect(fortHtml).toContain('never joins');
    const merc = Object.values(state.nations).find((n) => n.indep?.personality === 'mercantile');
    expect(renderToStaticMarkup(React.createElement(IndependentStatus, { state, dispatch: vi.fn(), nation: merc }))).toContain('propose-trade');
  });

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
