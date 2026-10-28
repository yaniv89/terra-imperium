import { describe, it, expect } from 'vitest';
import { CARDS, cardOf, drawEvent, cooldownTurns, cardChoice, eraDawnCard, raidAftermathCard, RAID_AFTERMATH_TURNS, REST_GROWTH_MAX } from './eventDeck';
import { applyEventEffects } from './applyEventEffects';
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
    expect(later.some((e) => CARDS[e.templateId]?.requires?.max === 0)).toBe(false);
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
    // A consequence told in {city} is bound to the city of the draw that spawned it.
    const cityFree = [...Object.values(CARDS).filter((c) => c.kind === 'story'), ...Object.values(EVENT_CHAINS).filter((c) => !c.description.includes('{city}'))];
    cityFree.forEach((c) => (c.options || []).forEach((o) =>
      expect(Object.keys(o.effects || {}).filter((k) => /^city[A-Z]/.test(k)), `${c.id}: ${o.label}`).toEqual([])));
  });

  it('a consequence opens in the city that spawned it, named, and passes if the city is lost', () => {
    const base = quiet();
    const city = Object.values(base.regions).find((c) => c.owner === base.playerNationId);
    const pending = [{ id: 'hunger_at_doors', dueTurn: 20, cityId: city.id }];
    const out = drawEvent({ ...base, turnNumber: 20, proceduralEventCooldown: 9, pendingEventChains: pending }, createRng(1));
    expect(out.activeProceduralEvent).toMatchObject({ id: 'hunger_at_doors', cityId: city.id });
    expect(out.activeProceduralEvent.description).toContain(city.name);
    const lost = { ...base, regions: { ...base.regions, [city.id]: { ...city, owner: 'nobody' } } };
    const gone = drawEvent({ ...lost, turnNumber: 20, proceduralEventCooldown: 9, pendingEventChains: pending }, createRng(1));
    expect(gone.activeEventId).toBeNull();
    expect(gone.pendingEventChains).toEqual([]);
  });

  it('every common draw has an option that leads to a consequence', () => {
    ['frontier_raiders', 'failed_harvest', 'river_flood', 'traveling_merchants', 'coastal_trade_boom', 'refugee_crisis'].forEach((id) => {
      const t = PROCEDURAL_TEMPLATES.find((x) => x.id === id);
      const city = Object.values(quiet().regions).find((c) => c.owner === quiet().playerNationId);
      const next = t.build(quiet(), createRng(1), city).options.map((o) => o.effects.spawnFollowUp?.id).filter(Boolean);
      expect(next.length, id).toBeGreaterThan(0);
      next.forEach((n) => expect(CARDS[n]?.kind, n).toBe('link'));
    });
  });

  it('a drawn card rests longer each time it is drawn', () => {
    const s = quiet();
    const cd = cooldownTurns(s, 'template');
    const seen = {};
    play(s, 300).filter((e) => e.templateId).forEach((e) => {
      const prev = seen[e.templateId];
      if (prev) expect(e.turn - prev.turn, e.templateId).toBeGreaterThanOrEqual(cd * (1 + Math.min(prev.n, REST_GROWTH_MAX)));
      seen[e.templateId] = { turn: e.turn, n: (prev?.n || 0) + 1 };
    });
    expect(Object.values(seen).some((x) => x.n > 1)).toBe(true);
  });

  it('no drawn card offers an option that is as good or better than another on every count', () => {
    const s = quiet();
    const city = Object.values(s.regions).find((c) => c.owner === s.playerNationId);
    Object.values(CARDS).filter((c) => c.kind === 'draw' && !c.subjects && c.id.startsWith('ai_')).forEach((c) =>
      expect(cardChoice(c.build(s, createRng(1), city).options).dominated, c.id).toBe(false));
    expect(cardChoice([{ effects: { gold: 120 } }, { effects: { gold: 100 } }])).toMatchObject({ dominated: true, goldOnly: true, real: false });
    expect(cardChoice([{ effects: { gold: -40, stability: 1 } }, { effects: { prestige: -3 } }])).toMatchObject({ dominated: false, real: true });
  });

  it('the age dawn card asks for a focus once an age, and the chosen goal is kept', () => {
    const s = quiet({ proceduralEventCooldown: 0 });
    const card = eraDawnCard(s);
    expect(card.options.length).toBeGreaterThanOrEqual(2);
    expect(card.options.every((o) => o.effects.eraFocus)).toBe(true);
    const out = drawEvent({ ...s, turnNumber: 11 }, createRng(1));
    expect(out.activeProceduralEvent?.templateId).toBe('era_dawn');
    expect(eraDawnCard({ ...s, eventHistory: out.eventHistory })).toBeNull();
    const answered = applyEventEffects({ ...s, ...out, logs: [] }, out.activeProceduralEvent, 0);
    const age = Object.keys(answered.nations[s.playerNationId].eraGoals)[0];
    expect(answered.nations[s.playerNationId].eraGoals[age].focus).toBe(card.options[0].effects.eraFocus);
  });

  it('a raid on a city of the player opens its aftermath once, and the answer moves the raiders\' grudge', () => {
    const base = quiet({ turnNumber: 40 });
    const me = base.playerNationId;
    const city = Object.values(base.regions).find((c) => c.owner === me);
    const raider = { id: 'raiders_x', name: 'Hill Raiders', kind: 'independent', indep: { personality: 'raiders' } };
    const raided = { ...base, nations: { ...base.nations, [raider.id]: { ...raider, indep: { ...raider.indep, lastRaidOnPlayer: { turn: 39, kind: 'sack', won: true, loot: 10, cityId: city.id } } } } };
    const out = drawEvent({ ...raided, proceduralEventCooldown: 9 }, createRng(1));
    expect(out.activeProceduralEvent).toMatchObject({ templateId: 'raid_suffered', cityId: city.id, indepId: raider.id });
    expect(out.activeProceduralEvent.description).toContain(city.name);
    expect(raidAftermathCard({ ...raided, eventHistory: out.eventHistory })).toBeNull(); // once a raid
    expect(raidAftermathCard({ ...raided, turnNumber: 39 + RAID_AFTERMATH_TURNS + 1 })).toBeNull(); // too late
    const terms = applyEventEffects({ ...raided, logs: [] }, out.activeProceduralEvent, 1);
    const revenge = applyEventEffects({ ...raided, logs: [] }, out.activeProceduralEvent, 0);
    const g = (st) => st.nations[raider.id].indep?.grudges?.[me] || 0;
    expect(g(revenge)).toBeGreaterThan(g(raided));
    expect(g(terms)).toBeLessThanOrEqual(g(raided));
    expect(cardChoice(out.activeProceduralEvent.options).real).toBe(true);
  });
});
