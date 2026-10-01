// Without intelligence the pre-battle sheet used to show no odds at all; now it shows the scouts'
// band, and exact numbers stay behind intel.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNeighborIds } from '../../data/regions';
import PreBattleModal from './PreBattleModal';

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));

describe('pre-battle odds without intel', () => {
  it("shows the scouts' estimate and hides the exact odds", () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const from = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && getNeighborIds(id).some((n) => state.regions[n]?.owner === 'de'));
    const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === 'de');
    game.state = {
      ...state,
      wars: [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, score: 0 }],
      resources: { ...state.resources, gold: 10000, mil: 1000 },
      units: {
        a: { id: 'a', ownerId: 'fr', regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 },
        d: { id: 'd', ownerId: 'de', regionId: target, domain: 'land', classId: 'infantry', strength: 300, maxStrength: 300, morale: 100, movesLeft: 1 }
      }
    };
    const html = renderToStaticMarkup(React.createElement(PreBattleModal, { fromRegionId: from, targetRegionId: target, onClose: vi.fn() }));
    expect(html).toContain('data-testid="battle-odds-scouts"');
    expect(html).toContain('Likely win');
    expect(html).not.toContain('data-testid="battle-odds"');
  });
});
