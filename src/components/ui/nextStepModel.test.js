import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { peoplesWorld } from '../../engine/testWorld';
import { nextStep } from './nextStepModel';

const queue = (s, step) => gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: step.queue });

describe('next step (newcomer flow)', () => {
  it('walks a new player through settle, scouts or army, ship, one queue tap at a time', () => {
    let s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const cap = s.nations[me].capitalRegionId;
    // a size 2 capital, no units of its own
    s = { ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], size: 2 } }, units: Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.ownerId !== me)) };
    const seen = [];
    for (let i = 0; i < 6; i++) {
      const step = nextStep(s);
      if (!step?.queue) break;
      seen.push(step.id);
      expect(step.queue.cityId).toBe(cap);
      expect(step.label).toMatch(/\w/);
      const next = queue(s, step);
      expect(next.regions[cap].production).not.toEqual(s.regions[cap].production); // the tap really queues it
      s = next;
    }
    expect(seen[0]).toBe('settle');
    expect(seen).toContain('army');
    expect(new Set(seen).size).toBe(seen.length); // a queued step never comes back
  }, 60000);

  it('sends an idle scout exploring, and says nothing while the guide runs', () => {
    let s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const cap = s.regions[s.nations[me].capitalRegionId];
    s = { ...s, units: { ...s.units, sc: { id: 'sc', ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: cap.tile, domain: 'land', classId: 'support', explorer: true, strength: 300, maxStrength: 300, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null } } };
    expect(nextStep(s)).toMatchObject({ id: 'explore', explore: { unitIds: ['sc'] } });
    const sent = gameReducer(s, { type: ActionTypes.EXPLORE_ORDER, payload: { unitIds: ['sc'] } });
    expect(nextStep(sent)?.id).not.toBe('explore');
    expect(nextStep({ ...s, tutorial: { startTurn: s.turnNumber, done: {} } })).toBeNull();
  }, 60000);
});
