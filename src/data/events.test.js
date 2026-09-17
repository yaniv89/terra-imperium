import { describe, it, expect } from 'vitest';
import { shouldEventFire, pickNextEvent, HISTORICAL_EVENTS } from './events';
import { START_YEAR, END_YEAR, AGE_ORDER, getCalendarAgeId } from './ages';
import { EVENT_CHAINS } from './eventChains';

// Fixture events (independent of the real HISTORICAL_EVENTS content) exercise the generic
// scheduling mechanism in isolation.
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

  it('returns null when nothing is eligible', () => {
    const eligible = Object.values(FIXTURE_EVENTS).filter(e => shouldEventFire(e, 500, {}, {}));
    expect(eligible).toEqual([]);
  });
});

describe('pickNextEvent against real HISTORICAL_EVENTS content', () => {
  it('returns null before any real event\'s year has arrived', () => {
    expect(pickNextEvent(START_YEAR, {}, {})).toBeNull();
  });

  it('picks the earliest-year real event once its year has arrived', () => {
    const earliestYear = Math.min(...Object.values(HISTORICAL_EVENTS).map(e => e.year));
    const event = pickNextEvent(earliestYear, {}, {});
    expect(event.year).toBe(earliestYear);
  });

  it('never re-selects an already-fired real event', () => {
    const earliest = Object.values(HISTORICAL_EVENTS).reduce((a, b) => (a.year <= b.year ? a : b));
    const next = pickNextEvent(END_YEAR, {}, { [earliest.id]: true });
    expect(next?.id).not.toBe(earliest.id);
  });

  it('eventually fires every real event across a full playthrough\'s year range', () => {
    let firedEvents = {};
    let firedCount = 0;
    for (let year = START_YEAR; year <= END_YEAR; year += 1) {
      const event = pickNextEvent(year, {}, firedEvents);
      if (event) { firedEvents = { ...firedEvents, [event.id]: true }; firedCount += 1; }
    }
    expect(firedCount).toBe(Object.keys(HISTORICAL_EVENTS).length);
  });
});

describe('HISTORICAL_EVENTS data integrity', () => {
  it('every event\'s own id matches its registry key', () => {
    Object.entries(HISTORICAL_EVENTS).forEach(([key, event]) => expect(event.id).toBe(key));
  });

  it('every event falls within the game\'s year range', () => {
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      expect(event.year).toBeGreaterThanOrEqual(START_YEAR);
      expect(event.year).toBeLessThanOrEqual(END_YEAR);
    });
  });

  it('every event has at least two options, each with a label and a non-empty effect', () => {
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      event.options.forEach(option => {
        expect(option.label).toBeTruthy();
        expect(Object.keys(option.effects || {}).length).toBeGreaterThan(0);
      });
    });
  });

  it('every age has at least two world events (plan §9.5\'s "world events... every age")', () => {
    const ageCounts = {};
    AGE_ORDER.forEach(id => { ageCounts[id] = 0; });
    Object.values(HISTORICAL_EVENTS).forEach(event => { ageCounts[getCalendarAgeId(event.year)] += 1; });
    AGE_ORDER.forEach(ageId => expect(ageCounts[ageId]).toBeGreaterThanOrEqual(2));
  });

  it('never spawns a follow-up that points at a nonexistent chain entry', () => {
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      event.options.forEach(option => {
        const followUp = option.effects.spawnFollowUp;
        if (followUp) expect(EVENT_CHAINS[followUp.id]).toBeDefined();
      });
    });
  });

  it('never references a specific nation or region — world events must stay alt-history tolerant', () => {
    // These effect keys name a specific nation/region id, which only makes sense for content that
    // already knows who's playing (situational/procedural events, curated national flavor) — a
    // generic world event must survive any of the 240 possible starting nations, in any era.
    const identitySpecificKeys = ['captureRegions', 'returnRegion', 'peaceWith', 'tradeWith', 'warWith', 'nationHostility'];
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      event.options.forEach(option => {
        identitySpecificKeys.forEach(key => expect(option.effects).not.toHaveProperty(key));
      });
    });
  });
});
