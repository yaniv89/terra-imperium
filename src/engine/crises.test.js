import { describe, it, expect } from 'vitest';
import { crisisDue, processCrises, hitNations, crisisComing, famineShare, CHECK_PERIOD, MAX_HIT, FAMINE_SHARE } from './crises';
import { CRISES, crisisCardId } from '../data/crises';
import { cardOf } from './eventDeck';
import { peoplesWorld, cloneWorld, majorIds, addCities } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { peopleOf } from './population';
import { growthThreshold } from './world/cities';
import { speedCostMult } from '../data/ages';

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
    const t0 = dueTurn(s0);
    // The warning first: nothing changes yet, the crisis waits in state.crises.coming.
    const warned = processCrises({ ...s0, turnNumber: t0 });
    expect(warned.logs).toEqual([]);
    expect(warned.crises.coming).toMatchObject({ id: 'bronze_collapse' });
    expect(warned.crises.coming.turn).toBeGreaterThan(t0);
    expect(crisisComing({ ...s0, crises: warned.crises })).toMatchObject({ turn: warned.crises.coming.turn });
    expect(processCrises({ ...s0, crises: warned.crises, turnNumber: warned.crises.coming.turn - 1 })).toBe(null);
    const s = { ...s0, crises: warned.crises, turnNumber: warned.crises.coming.turn };
    const unitsBefore = JSON.stringify(Object.values(s.units).filter((u) => u.ownerId === s.playerNationId));
    const out = processCrises(s);
    expect(out.crises.coming).toBeUndefined();
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

  it('runs inside resolveTurn: the warning, then the strike and the player\'s story', () => {
    const s0 = world('bronze');
    const t = dueTurn(s0);
    const fired = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
    const quiet = { firedEvents: fired, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const warned = resolveTurn({ ...s0, ...quiet, turnNumber: t - 1 });
    expect(warned.crises?.coming?.id).toBe('bronze_collapse');
    expect(warned.crises.history).toBeUndefined();
    const next = resolveTurn({ ...warned, ...quiet, activeEventId: null, pendingEventChains: [], turnNumber: warned.crises.coming.turn - 1 });
    expect(next.crises?.history?.[0]?.id).toBe('bronze_collapse');
    expect(next.activeEventId).toBe(crisisCardId('bronze_collapse'));
  });

  it('hits the player as often as any other nation that qualifies (a seeded draw, not the largest)', () => {
    let s = world('bronze');
    majorIds(s).slice(4, 14).forEach((id) => { s = addCities(s, id, 2).state; });
    const n = hitNations(s, collapse).length;
    expect(n).toBeGreaterThan(MAX_HIT);
    const hits = {};
    let draws = 0;
    for (let t = CHECK_PERIOD; t < 20000 && draws < 300; t += CHECK_PERIOD) {
      const due = crisisDue({ ...s, turnNumber: t });
      if (!due) continue;
      draws += 1;
      due.hit.forEach((id) => { hits[id] = (hits[id] || 0) + 1; });
    }
    const expected = (draws * MAX_HIT) / n;
    expect(hits[s.playerNationId]).toBeGreaterThan(expected * 0.7);
    expect(hits[s.playerNationId]).toBeLessThan(expected * 1.3);
  });

  it('a world war never makes the player the aggressor', () => {
    const s = world('bronze');
    const rival = majorIds(s)[1];
    const out = processCrises({ ...s, turnNumber: 50, crises: { coming: { id: 'world_war', turn: 50, nations: [s.playerNationId, rival] } } });
    const war = out.wars.find((w) => w.active && w.enemy === s.playerNationId);
    expect(war?.aggressor).toBe(rival);
  });

  it('explore mode or crises off drop an announced crisis: it never strikes', () => {
    const s = world('bronze');
    const crises = { coming: { id: 'bronze_collapse', turn: 50, nations: [s.playerNationId] } };
    [{ explore: true }, { crises: 'off' }].forEach((settings) => {
      const out = processCrises({ ...s, turnNumber: 50, crises, settings });
      expect(out.crises.coming).toBeUndefined();
      expect(out.crises.history).toBeUndefined();
      expect(crisisComing({ ...s, crises, settings })).toBe(null);
    });
  });

  it('a world war whose other side fell before it struck starts no war', () => {
    const s = world('bronze');
    const rival = majorIds(s)[1];
    s.nations[rival] = { ...s.nations[rival], isEliminated: true };
    const out = processCrises({ ...s, turnNumber: 50, crises: { coming: { id: 'world_war', turn: 50, nations: [s.playerNationId, rival] } } });
    expect(out.wars).toBe(s.wars);
    expect(out.crises.coming).toBeUndefined();
  });

  it('a famine takes half as much from a city with a Granary or better', () => {
    expect(famineShare({ size: 4, food: 0 })).toBe(FAMINE_SHARE);
    expect(famineShare({ size: 4, food: 0, buildings: { categories: { food: 0 } } })).toBe(FAMINE_SHARE); // Storage Pits are not a Granary
    expect(famineShare({ size: 4, food: 0, buildings: { categories: { food: 1 } } })).toBe(FAMINE_SHARE / 2);
    expect(famineShare({ size: 4, food: 999, buildings: { categories: { food: 3 } } })).toBe(FAMINE_SHARE / 2); // the store does not count
    const s = world('bronze');
    const cap = s.regions[s.nations[s.playerNationId].capitalRegionId];
    s.regions[cap.id] = { ...cap, food: 0, buildings: { ...cap.buildings, categories: { ...cap.buildings?.categories, food: -1 } } };
    const bare = { ...s, regions: { ...s.regions }, turnNumber: 50, crises: { coming: { id: 'little_ice_age', turn: 50, nations: [s.playerNationId] } } };
    processCrises(bare);
    const fed = { ...bare, regions: { ...s.regions, [cap.id]: { ...s.regions[cap.id], buildings: { ...cap.buildings, categories: { ...cap.buildings?.categories, food: 1 } } } } };
    processCrises(fed);
    expect(fed.regions[cap.id].currentPopulation).toBeGreaterThan(bare.regions[cap.id].currentPopulation);
  });

  it('a famine draws at the game speed: the people number it leaves is the one the next turn writes', () => {
    const s = { ...world('bronze'), gameSpeed: 'normal' };
    const capId = s.nations[s.playerNationId].capitalRegionId;
    const at = { ...s, regions: { ...s.regions }, turnNumber: 50, crises: { coming: { id: 'little_ice_age', turn: 50, nations: [s.playerNationId] } } };
    processCrises(at);
    const c = at.regions[capId];
    expect(c.currentPopulation).toBeLessThan(s.regions[capId].currentPopulation);
    expect(c.currentPopulation).toBe(peopleOf(c, growthThreshold(c.size, speedCostMult('normal', 'bronze'))));
  });

  it('the player may answer a coming crisis during its warning: the choice is paid at the strike, the card does not open again', () => {
    const s0 = world('bronze');
    const s = { ...s0, turnNumber: 45, crises: { coming: { id: 'bronze_collapse', turn: 50, nations: [s0.playerNationId] } } };
    const opened = gameReducer(s, { type: ActionTypes.ANSWER_CRISIS_EARLY });
    expect(opened.activeEventId).toBe(crisisCardId('bronze_collapse'));
    expect(crisisComing(opened).answered).toBe(true);
    expect(gameReducer({ ...opened, activeEventId: null }, { type: ActionTypes.ANSWER_CRISIS_EARLY }).activeEventId).toBe(null); // once
    const gold = opened.resources.gold;
    const answered = gameReducer(opened, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    expect(answered.activeEventId).toBe(null);
    expect(answered.resources.gold).toBe(gold); // nothing paid during the warning
    expect(answered.crises.coming.choice).toBe(0);
    const out = processCrises({ ...answered, turnNumber: 50 });
    expect(out.crises.history[0].id).toBe('bronze_collapse');
    expect(out.choice).toBe(0);
    expect(out.pendingEventChains || []).not.toContainEqual({ id: crisisCardId('bronze_collapse'), dueTurn: 50 });
    // Through resolveTurn: the strike pays the option (bronze_collapse 0: -40 gold) on top of the same turn.
    const fired = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
    const quiet = { firedEvents: fired, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }, turnNumber: 49 };
    const paid = resolveTurn({ ...answered, ...quiet });
    const unpaid = resolveTurn({ ...answered, ...quiet, crises: { coming: { ...answered.crises.coming, choice: undefined } } });
    expect(paid.crises.history.at(-1).id).toBe('bronze_collapse');
    expect(paid.resources.gold).toBe(unpaid.resources.gold - 40);
    expect(paid.activeEventId).toBe(unpaid.activeEventId);
    // A crisis dropped before it strikes (crises switched off) pays nothing.
    const off = { ...answered, settings: { ...answered.settings, crises: 'off' } };
    expect(processCrises({ ...off, turnNumber: 50 }).choice).toBeUndefined();
    expect(resolveTurn({ ...off, ...quiet }).resources.gold).toBe(resolveTurn({ ...off, ...quiet, crises: {} }).resources.gold);
    // Not answered: the card opens at the strike as before.
    expect(processCrises({ ...s, turnNumber: 50 }).pendingEventChains).toContainEqual({ id: crisisCardId('bronze_collapse'), dueTurn: 50 });
    // Nothing coming for the player: no card.
    expect(gameReducer(s0, { type: ActionTypes.ANSWER_CRISIS_EARLY })).toBe(s0);
  });
});
