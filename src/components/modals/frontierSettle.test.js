// Regression (the card part still applies to colonies, plan §4h): frontier land (an emergent world's unowned regions) showed no actions at all, so a
// player with an army right next to it had no way to claim it. The card's action block was gated
// on the region having an owner nation.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes } from '../../data/types';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { getNeighborIds } from '../../data/regions';
import RegionInfoModal from './RegionInfoModal';

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));
vi.mock('../../context/MapInsetsContext', () => ({ useReportInset: () => {} }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../hooks/useAutoPeek', () => ({ useAutoPeek: () => [false, vi.fn()] }));

const expeditionButton = (html) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => b.includes('Live alongside them'));
const render = (regionId) => renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId, onClose: vi.fn() }));

describe('founding a colony on the region card (plan §4h)', () => {
  let home; let frontier;
  beforeEach(() => {
    game.state = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount: 15, seed: 7 } });
    home = Object.keys(game.state.regions).find((id) => game.state.regions[id].owner === 'fr'
      && getNeighborIds(id).some((n) => game.state.regions[n]?.owner === null && game.state.regions[n]?.neutral));
    frontier = getNeighborIds(home).find((n) => game.state.regions[n]?.owner === null && game.state.regions[n]?.neutral);
    game.state.resources = { ...game.state.resources, gold: 10000, adm: 50, supplies: 50 };
    game.state.units = { army: { id: 'army', ownerId: 'fr', regionId: home, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, movesLeft: 1 } };
  });

  it('shows enabled colony options when an army with a move stands next to it', () => {
    expect(frontier).toBeDefined();
    const button = expeditionButton(render(frontier));
    expect(button).toBeDefined();
    expect(button).not.toContain('disabled=""');
  });

  it('shows the button with the reason when no army can go', () => {
    game.state.units.army.movesLeft = 0;
    const html = render(frontier);
    expect(expeditionButton(html)).toContain('disabled=""');
    expect(html).toContain('Needs a land army next to it with a move left');
  });

  it('founding starts a colony on the land, which becomes yours over the next turns', () => {
    const next = gameReducer(game.state, { type: ActionTypes.FOUND_COLONY, payload: { regionId: frontier, policy: 'coexist' } });
    expect(next.regions[frontier].colony.ownerId).toBe('fr');
    expect(next.regions[frontier].owner).toBe(null);
  });
});
