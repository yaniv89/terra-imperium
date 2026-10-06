// Phase W2 placeholder UI: an independent's status and mercenary market in the city panel.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import IndependentStatus from './IndependentStatus';
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
