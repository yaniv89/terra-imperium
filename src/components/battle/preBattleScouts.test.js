// Without intelligence the pre-battle sheet used to show no odds at all; now it shows the scouts'
// band, and exact numbers stay behind intel.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getNeighborIds } from '../../data/regions';
import PreBattleModal from './PreBattleModal';
import { atGates } from '../../engine/testWorld';
import { peoplesWorld, rivalOf, withBorder } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));

describe('pre-battle odds without intel', () => {
  it("shows the scouts' estimate and hides the exact odds", { timeout: 20000 }, () => {
    const state = withBorder(WORLD, FR, DE);
    const from = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && getNeighborIds(id).some((n) => state.regions[n]?.owner === DE));
    const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === DE);
    game.state = {
      ...state,
      wars: [{ id: 'w', aggressor: FR, enemy: DE, active: true, score: 0 }],
      resources: { ...state.resources, gold: 10000, mil: 1000 },
      units: {
        a: { id: 'a', ownerId: FR, regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 },
        d: { id: 'd', ownerId: DE, regionId: target, domain: 'land', classId: 'infantry', strength: 300, maxStrength: 300, morale: 100, movesLeft: 1 }
      }
    };
    game.state = atGates(game.state, from, target);
    const html = renderToStaticMarkup(React.createElement(PreBattleModal, { fromRegionId: from, targetRegionId: target, onClose: vi.fn() }));
    expect(html).toContain('data-testid="battle-odds-scouts"');
    expect(html).toContain('Likely win');
    expect(html).not.toContain('data-testid="battle-odds"');
  });
});
