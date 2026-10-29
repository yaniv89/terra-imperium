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

  it('asks to sail a ship that has never left port, until one is at sea or carries troops', () => {
    let s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const cap = s.regions[s.nations[me].capitalRegionId];
    const unit = (id, extra) => ({ id, ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: cap.tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });
    const mine = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.ownerId !== me));
    // a settler out (no settle step), a scout on hold (no scouts step), an army, a ship in the capital's port
    s = { ...s, units: { ...mine, st: unit('st', { classId: 'settler' }), sc: unit('sc', { classId: 'support', explorer: true, hold: true }), inf: unit('inf'), sh: unit('sh', { domain: 'naval', classId: 'naval', navalLine: 'warship' }) }, fog: { ...s.fog, met: {} } };
    expect(nextStep(s)).toMatchObject({ id: 'sail', sail: { regionId: cap.id, unitIds: ['sh'] } });
    expect(nextStep(s).label).toMatch(/\w/);
    // troops aboard: the player knows what the ship is for
    expect(nextStep({ ...s, units: { ...s.units, inf: { ...s.units.inf, embarkedOn: 'sh' } } })?.id).not.toBe('sail');
    // sailing
    expect(nextStep({ ...s, units: { ...s.units, sh: { ...s.units.sh, route: [cap.tile] } } })?.id).not.toBe('sail');
  }, 60000);
});
