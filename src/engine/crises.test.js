import { describe, it, expect } from 'vitest';
import { crisisDue, processCrises, hitNations, CHECK_PERIOD } from './crises';
import { CRISES, crisisCardId } from '../data/crises';
import { cardOf } from './eventDeck';
import { peoplesWorld, cloneWorld, majorIds, addCities } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';

const collapse = CRISES.find((c) => c.id === 'bronze_collapse');

// A world whose first four majors hold three cities each, every nation in `age`.
const world = (age = 'bronze') => {
  let s = cloneWorld(peoplesWorld({ seed: 11 }));
  majorIds(s).slice(0, 4).forEach((id) => { s = addCities(s, id, 2).state; });
  s.techAgeId = age;
  Object.values(s.nations).forEach((n) => { n.tech = { ...(n.tech || {}), ageId: age }; });
  return s;
};
// The first turn the seeded roll lets a crisis start in `s`.
const dueTurn = (s) => { for (let t = CHECK_PERIOD; t < 5000; t += CHECK_PERIOD) if (crisisDue({ ...s, turnNumber: t })) return t; return null; };

describe('history crises (U31)', () => {
  it('starts only when its predicates hold: a Stone Age world has none', () => {
    expect(dueTurn(world('stone'))).toBe(null);
    const s = world('bronze');
    const t = dueTurn(s);
    expect(t).not.toBe(null);
    expect(crisisDue({ ...s, turnNumber: t }).crisis.id).toBe('bronze_collapse');
    expect(crisisDue({ ...s, turnNumber: t + 1 })).toBe(null); // only on check turns
  });

  it('never hits a nation outside its age window', () => {
    const s = world('bronze');
    const rival = majorIds(s)[1];
    expect(hitNations(s, collapse)).toContain(rival);
    s.nations[rival].tech.ageId = 'classical';
    expect(hitNations(s, collapse)).not.toContain(rival);
  });

  it("'off' stops all", () => {
    const s = { ...world('bronze'), settings: { crises: 'off' } };
    expect(dueTurn(s)).toBe(null);
  });

  it('a collapse loosens outer cities, spares capitals and the player\'s units, rests, and opens the story', () => {
    const s0 = world('bronze');
    const s = { ...s0, turnNumber: dueTurn(s0) };
    const unitsBefore = JSON.stringify(Object.values(s.units).filter((u) => u.ownerId === s.playerNationId));
    const out = processCrises(s);
    expect(out.crises.history[0]).toMatchObject({ id: 'bronze_collapse', turn: s.turnNumber });
    const hit = new Set(out.crises.history[0].nations);
    expect(hit.has(s.playerNationId)).toBe(true);
    Object.values(s.regions).filter((c) => hit.has(c.owner)).forEach((c) => {
      if (c.isCapital) expect(c.loyalty ?? 100).toBe(100); else expect(c.loyalty).toBeLessThan(100);
    });
    expect(JSON.stringify(Object.values(s.units).filter((u) => u.ownerId === s.playerNationId))).toBe(unitsBefore);
    expect(out.pendingEventChains).toContainEqual({ id: crisisCardId('bronze_collapse'), dueTurn: s.turnNumber });
    expect(cardOf(crisisCardId('bronze_collapse')).options.length).toBe(2);
    // The same crisis rests after it: the next due check is not a collapse within its cooldown.
    expect(crisisDue({ ...s, crises: out.crises, turnNumber: s.turnNumber + CHECK_PERIOD })).toBe(null);
  });

  it('runs inside resolveTurn and shows the player its story', () => {
    const s0 = world('bronze');
    const t = dueTurn(s0);
    const fired = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
    const next = resolveTurn({ ...s0, turnNumber: t - 1, firedEvents: fired, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
    expect(next.crises?.history?.[0]?.id).toBe('bronze_collapse');
    expect(next.activeEventId).toBe(crisisCardId('bronze_collapse'));
  });
});
