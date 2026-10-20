// src/hooks/dismissOverlays.test.js
// H-17: End Turn closes every dismissable overlay (a sheet, the log, march mode) and then acts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { interactions } from './useExclusivePanel';
import { endTurnPress } from '../components/ui/endTurnModel';
import { peoplesWorld } from '../engine/testWorld';

beforeEach(() => interactions.reset());

describe('dismissing overlays', () => {
  it('calls every registered dismisser once, and not one that withdrew', () => {
    const log = vi.fn(); const march = vi.fn(); const gone = vi.fn();
    const offLog = interactions.addDismisser(log);
    interactions.addDismisser(march);
    interactions.addDismisser(gone)();
    interactions.dismissOverlays();
    expect(log).toHaveBeenCalledTimes(1);
    expect(march).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();
    offLog();
    interactions.dismissOverlays();
    expect(log).toHaveBeenCalledTimes(1);
  });
  it('with nothing to answer, one press ends the turn (the dismissing is the dock\'s first step)', () => {
    const s = peoplesWorld({ seed: 7 });
    const ready = { ...s, regions: Object.fromEntries(Object.entries(s.regions).map(([k, c]) => [k, c.owner === s.playerNationId ? { ...c, production: { current: { kind: 'building', category: 'food', tier: 0 }, queue: [], progress: 0 } } : c])), research: { ...s.research, current: 'infrastructure_irrigation_canals' } };
    expect(endTurnPress(ready, {})).toEqual({ end: true });
  });
});
