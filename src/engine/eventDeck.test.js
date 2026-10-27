import { describe, it, expect } from 'vitest';
import { CARDS, cardOf, drawEvent, cooldownTurns } from './eventDeck';
import { factsUsed, predicateMet, factContext } from './predicates';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { PROCEDURAL_TEMPLATES } from '../data/proceduralEvents';
import { AGE_ORDER } from '../data/ages';
import { peoplesWorld } from './testWorld';
import { createRng } from '../utils/rng';

const ALL_FIRED = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
const quiet = (extra = {}) => ({ ...peoplesWorld({ seed: 5 }), firedEvents: ALL_FIRED, turnNumber: 10, ...extra });

// Plays `turns` turns of draws only (every story already fired), answering each event at once.
const play = (state, turns) => {
  const fired = [];
  let s = state;
  for (let t = 0; t < turns; t += 1) {
    const rng = createRng(1000 + t);
    const out = drawEvent({ ...s, turnNumber: s.turnNumber + 1 }, rng);
    s = { ...s, ...out, turnNumber: s.turnNumber + 1, activeEventId: null, activeProceduralEvent: null };
    if (out.activeProceduralEvent) fired.push({ ...out.activeProceduralEvent, turn: s.turnNumber });
  }
  return fired;
};

describe('event deck (U26)', () => {
  it('every old event id exists as a card', () => {
    [...Object.keys(HISTORICAL_EVENTS), ...Object.keys(EVENT_CHAINS), ...PROCEDURAL_TEMPLATES.map((t) => t.id)]
      .forEach((id) => expect(CARDS[id], id).toBeDefined());
    expect(cardOf('colonial_venture_1').title).toBe(EVENT_CHAINS.colonial_venture_1.title);
    expect(cardOf('good_harvest')).toBeNull(); // a draw card is never fired by id
  });

  it('a card with an unmet requirement never fires', () => {
    const noGenerals = play(quiet({ hiredCommanders: {} }), 120);
    expect(noGenerals.length).toBeGreaterThan(0);
    expect(noGenerals.some((e) => e.templateId === 'ambitious_general')).toBe(false);
    // The first age's flavour cards stop once the player has left it (the age rule is a predicate).
    const later = play(quiet({ techAgeId: AGE_ORDER[1] }), 120);
    expect(later.some((e) => CARDS[e.templateId].requires?.max === 0)).toBe(false);
    expect(later.length).toBeGreaterThan(0);
  });

  it('a link fires after its delay, at the city its story bound', () => {
    const base = quiet();
    const city = Object.values(base.regions).find((c) => c.owner === base.playerNationId);
    const pending = [{ id: 'border_dispute_1', dueTurn: 20 }, { id: 'tech_gamble_1', dueTurn: 22, cityId: city.id }];
    const early = drawEvent({ ...base, turnNumber: 19, proceduralEventCooldown: 9, pendingEventChains: pending }, createRng(1));
    expect(early.activeEventId).toBeNull();
    expect(early.pendingEventChains).toEqual(pending);
    const due = drawEvent({ ...base, turnNumber: 20, pendingEventChains: pending }, createRng(1));
    expect(due.activeEventId).toBe('border_dispute_1');
    expect(due.pendingEventChains).toEqual([pending[1]]);
    const bound = drawEvent({ ...base, turnNumber: 22, pendingEventChains: [pending[1]] }, createRng(1));
    expect(bound.activeProceduralEvent).toMatchObject({ id: 'tech_gamble_1', cityId: city.id, tile: city.tile });
    expect(bound.pendingEventChains).toEqual([]);
  });

  it('no family repeats inside its cooldown over 300 turns', () => {
    const state = quiet();
    const fired = play(state, 300);
    expect(fired.length).toBeGreaterThan(20);
    const gap = cooldownTurns(state, 'family');
    const last = {};
    fired.forEach((e) => {
      if (last[e.family] != null) expect(e.turn - last[e.family], e.family).toBeGreaterThanOrEqual(gap);
      last[e.family] = e.turn;
    });
  });

  it('no card reads a year', () => {
    const state = quiet({ firedEvents: {} });
    const a = drawEvent({ ...state, year: -3000 }, createRng(4));
    const b = drawEvent({ ...state, year: 1900 }, createRng(4));
    expect(a.activeEventId).toBe(b.activeEventId);
    Object.values(CARDS).forEach((c) => c.requires && expect(factsUsed(c.requires).some((f) => /year/i.test(f)), c.id).toBe(false));
  });

  it('a leaf with max bounds the fact from above (the age rule)', () => {
    expect(predicateMet({ fact: 'ageIndex', min: 0, max: 0 }, factContext({ playerNationId: 'p', techAgeId: AGE_ORDER[0] }, 'p'))).toBe(true);
    expect(predicateMet({ fact: 'ageIndex', min: 0, max: 0 }, factContext({ playerNationId: 'p', techAgeId: AGE_ORDER[1] }, 'p'))).toBe(false);
  });

  it('no story or chain card uses a city effect (they have no city, so it would do nothing)', () => {
    const cityFree = [...Object.values(CARDS).filter((c) => c.kind === 'story'), ...Object.values(EVENT_CHAINS)];
    cityFree.forEach((c) => (c.options || []).forEach((o) =>
      expect(Object.keys(o.effects || {}).filter((k) => /^city[A-Z]/.test(k)), `${c.id}: ${o.label}`).toEqual([])));
  });
});
