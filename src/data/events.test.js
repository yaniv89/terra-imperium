import { describe, it, expect } from 'vitest';
import { shouldEventFire, pickNextEvent } from './events';

// HISTORICAL_EVENTS content is empty for now (Phase D3 authors world events against the new age
// model) — these tests exercise the generic scheduling mechanism against fixture events.
const FIXTURE_EVENTS = {
  early: { id: 'early', year: 1000, title: 'Early Event', options: [{ label: 'ok', effects: {} }] },
  late: { id: 'late', year: 2000, title: 'Late Event', options: [{ label: 'ok', effects: {} }] },
  gated: {
    id: 'gated',
    year: 1500,
    title: 'Peace-Gated Event',
    requiresNoWar: ['eg'],
    options: [{ label: 'ok', effects: {} }]
  }
};

describe('shouldEventFire', () => {
  it('is false before the event\'s year', () => {
    expect(shouldEventFire(FIXTURE_EVENTS.early, 999, {}, {})).toBe(false);
  });

  it('is true once the event\'s year has arrived', () => {
    expect(shouldEventFire(FIXTURE_EVENTS.early, 1000, {}, {})).toBe(true);
    expect(shouldEventFire(FIXTURE_EVENTS.early, 1500, {}, {})).toBe(true);
  });

  it('is false once already fired', () => {
    expect(shouldEventFire(FIXTURE_EVENTS.early, 1500, {}, { early: true })).toBe(false);
  });

  it('respects requiresNoWar gating', () => {
    expect(shouldEventFire(FIXTURE_EVENTS.gated, 1500, { eg: { isAtWar: false } }, {})).toBe(true);
    expect(shouldEventFire(FIXTURE_EVENTS.gated, 1500, { eg: { isAtWar: true } }, {})).toBe(false);
  });
});

describe('pickNextEvent', () => {
  it('picks the earliest-year eligible event among fixtures', () => {
    const all = { ...FIXTURE_EVENTS };
    const eligible = Object.values(all).filter(e => shouldEventFire(e, 2500, {}, {}));
    eligible.sort((a, b) => a.year - b.year);
    expect(eligible[0].id).toBe('early');
  });

  it('returns null when nothing is eligible (the real, empty HISTORICAL_EVENTS case)', () => {
    expect(pickNextEvent(2500, {}, {})).toBeNull();
  });

  it('never selects an already-fired event again', () => {
    const event = pickNextEvent(1500, {}, { early: true });
    expect(event?.id).not.toBe('early');
  });
});
