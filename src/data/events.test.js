import { describe, it, expect } from 'vitest';
import { HISTORICAL_EVENTS, shouldEventFire, pickNextEvent } from './events';
import { GamePhases } from './types';

// Simulates the exact turn-by-turn loop advanceTurn/resolveTurn use: half-year ticks,
// one event resolved per turn via pickNextEvent(). Declares independence right after the
// UN Partition event fires, matching intended play.
const simulateEventOrder = () => {
  let year = 1870;
  let period = 0;
  let phase = GamePhases.PRE_STATE;
  const firedEvents = {};
  const order = [];

  for (let turn = 0; turn < 700; turn++) {
    const isH2 = period === 1;
    const newPeriod = isH2 ? 0 : 1;
    const newYear = isH2 ? year + 1 : year;

    const event = pickNextEvent(newYear, phase, {}, firedEvents);
    if (event) {
      firedEvents[event.id] = true;
      order.push(event.id);
      if (event.id === 'un_partition_1947') phase = GamePhases.POST_STATE;
    }
    year = newYear;
    period = newPeriod;
  }
  return order;
};

describe('event scheduling', () => {
  it('eventually fires every event exactly once on a full playthrough', () => {
    const order = simulateEventOrder();
    const allIds = Object.keys(HISTORICAL_EVENTS);

    // Every event fired.
    const missing = allIds.filter(id => !order.includes(id));
    expect(missing).toEqual([]);

    // No duplicates.
    expect(new Set(order).size).toBe(order.length);
  });

  it('fires both events of a shared year instead of losing the second one (regression: Oct 7 event)', () => {
    const order = simulateEventOrder();
    // 2023 has two scripted events: judicial_crisis_2023 and october_war_2023.
    expect(order).toContain('judicial_crisis_2023');
    expect(order).toContain('october_war_2023');
  });

  it('never selects an already-fired event again', () => {
    const fired = { balfour_1917: true };
    const event = pickNextEvent(1917, GamePhases.PRE_STATE, {}, fired);
    expect(event?.id).not.toBe('balfour_1917');
  });

  it('respects requiresNoWar gating', () => {
    const event = HISTORICAL_EVENTS.six_day_1967;
    expect(shouldEventFire(event, 1967, GamePhases.POST_STATE, { egypt: { isAtWar: false } }, {})).toBe(true);
    expect(shouldEventFire(event, 1967, GamePhases.POST_STATE, { egypt: { isAtWar: true } }, {})).toBe(false);
  });
});
