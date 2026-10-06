// src/engine/resolveTurnWorld.test.js
// Regression: the map changes the AI operations phase makes (pillage marks from threat.js
// pillageTile, field battle marks) used to be dropped, because resolveTurn assembled the next
// state with the world it held before that phase.
import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { getNationCapital } from '../data/regions';
import { HISTORICAL_EVENTS } from '../data/events';

// The real AI operations, plus one pillage mark on a French farm, written the way pillageTile does.
let markTile = null;
vi.mock('./aiOperations', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    processAIOperations: (state, rng) => {
      const out = real.processAIOperations(state, rng);
      if (markTile == null) return out;
      const entry = out.world?.tileState?.[markTile] || {};
      return { ...out, world: { ...out.world, tileState: { ...(out.world?.tileState || {}), [markTile]: { ...entry, improvement: entry.improvement || 'farm', pillaged: true, pillagedTurn: state.turnNumber } } } };
    }
  };
});

describe('resolveTurn keeps the AI operations phase\'s world', () => {
  it('a pillage mark made by the AI during the turn is still on the map afterwards', () => {
    const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const s = { ...S, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { defaultMode: 'auto', autoDefend: true } };
    const cap = getNationCapital('fr');
    const capTile = s.regions[cap].tile;
    const tile = Number(Object.keys(s.world.tileOwner).find((t) => s.world.tileOwner[t] === cap && Number(t) !== capTile));
    expect(Number.isFinite(tile)).toBe(true);
    expect(s.world.tileState?.[tile]?.pillaged).toBeFalsy();
    markTile = tile;
    const next = resolveTurn(s);
    markTile = null;
    expect(next.world.tileState[tile]).toMatchObject({ pillaged: true, pillagedTurn: next.turnNumber });
  }, 60000);
});
