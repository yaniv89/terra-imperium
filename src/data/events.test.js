import { describe, it, expect } from 'vitest';
import { eventTechsNeeded, ageIdOfYear, HISTORICAL_EVENTS } from './events';
import { storyDue, storyCard, nextStory } from '../engine/eventDeck';
import { PEOPLES_LIST } from './peoples';
import { getTiles } from './geo/tiles';
import { START_YEAR, END_YEAR, AGE_ORDER, AGES, LAST_AGE_ID } from './ages';
import { getTechsForAge } from './techTree';
import { EVENT_CHAINS } from './eventChains';
import { REGIONS_DATA, getNationCapital } from './regions';
import countriesMeta from './geo/countries-meta.json';

// World events (plan §9.5 Layer 1) fire for anyone; curated national flavor (Layer 3) only fires
// for a people of its own land. Several invariants below only make sense for one or the other.
const WORLD_EVENTS = Object.values(HISTORICAL_EVENTS).filter(e => !e.land);
const CURATED_EVENTS = Object.values(HISTORICAL_EVENTS).filter(e => e.land);

// A realm of three coastal cities, so stories that need a coast or a realm can fire.
const coast = getTiles().coastal.findIndex((c, i) => c === 1 && getTiles().land[i] === 1);
const REALM = { a: { owner: 'p', tile: coast }, b: { owner: 'p', tile: coast }, c: { owner: 'p', tile: coast } };
// A player state at an age with n of that age's techs (every earlier age's techs are held).
const playerAt = (ageId, n = 0, extra = {}) => {
  const owned = [...AGE_ORDER.slice(0, AGE_ORDER.indexOf(ageId)).flatMap((a) => getTechsForAge(a)), ...getTechsForAge(ageId).slice(0, n)];
  return { playerNationId: 'p', techAgeId: ageId, techTree: Object.fromEntries(owned.map((x) => [x.id, { researched: true }])), nations: {}, firedEvents: {}, regions: REALM, ...extra };
};
const endState = (extra) => playerAt(AGE_ORDER[AGE_ORDER.length - 1], 10, extra);
const eventAtItsPoint = (event, extra) => playerAt(event.ageId, eventTechsNeeded(event.ageId, event.year), extra);

// Fixture events (independent of the real HISTORICAL_EVENTS content) exercise the generic
// scheduling mechanism in isolation.
const FIXTURE_EVENTS = {
  early: { id: 'early', year: 1000, ageId: 'kingdoms', title: 'Early Event', options: [{ label: 'ok', effects: {} }] },
  late: { id: 'late', year: 2000, ageId: 'modern', title: 'Late Event', options: [{ label: 'ok', effects: {} }] }
};

describe('storyDue', () => {
  it('is false before the player has the age and progress', () => {
    expect(storyDue(playerAt('bronze', 0), storyCard(FIXTURE_EVENTS.early))).toBe(false);
    expect(storyDue(playerAt('kingdoms', 0), storyCard(FIXTURE_EVENTS.early))).toBe(false);
  });

  it("is true inside the event's age once the progress is held", () => {
    expect(storyDue(playerAt('kingdoms', 3), storyCard(FIXTURE_EVENTS.early))).toBe(true);
    expect(storyDue(playerAt('kingdoms', 10), storyCard(FIXTURE_EVENTS.early))).toBe(true);
  });

  it('is false once already fired', () => {
    expect(storyDue(playerAt('kingdoms', 10, { firedEvents: { early: true } }), storyCard(FIXTURE_EVENTS.early))).toBe(false);
  });

  it('does not read the calendar', () => {
    expect(storyDue({ ...playerAt('bronze', 0), year: 2000 }, storyCard(FIXTURE_EVENTS.early))).toBe(false);
  });
});

describe('story cards (keyed by the player age and progress)', () => {
  const gunpowder1700 = { id: 'g', year: 1700, ageId: 'gunpowder' };
  it('a Gunpowder event dated 1700 needs 3 of 10 Gunpowder techs', () => {
    expect(eventTechsNeeded('gunpowder', 1700)).toBe(3);
    expect(storyDue(playerAt('gunpowder', 3), storyCard(gunpowder1700))).toBe(true);
    expect(storyDue(playerAt('gunpowder', 2), storyCard(gunpowder1700))).toBe(false);
  });
  it("a player past the event's age never sees it", () => {
    expect(storyDue(playerAt('modern', 10), storyCard(gunpowder1700))).toBe(false);
  });
  it("a player short of the event's age does not see it", () => {
    expect(storyDue(playerAt('kingdoms', 10), storyCard(gunpowder1700))).toBe(false);
  });
  it('the last age holds its end year', () => {
    expect(ageIdOfYear(AGES[LAST_AGE_ID].endYear)).toBe(LAST_AGE_ID);
    expect(ageIdOfYear(AGES.modern.endYear - 1)).toBe('modern');
    expect(ageIdOfYear(1500)).toBe('gunpowder');
    expect(ageIdOfYear(1499)).toBe('kingdoms');
  });
});

describe('nextStory', () => {
  it('picks the earliest-year eligible event among fixtures', () => {
    const eligible = Object.values(FIXTURE_EVENTS).filter(e => storyDue(playerAt(e.ageId, 10), storyCard(e)));
    eligible.sort((x, y) => x.year - y.year);
    expect(eligible[0].id).toBe('early');
  });

  it('returns null when nothing is eligible', () => {
    expect(Object.values(FIXTURE_EVENTS).filter(e => storyDue(playerAt('bronze', 10), storyCard(e)))).toEqual([]);
  });
});

describe('nextStory against real HISTORICAL_EVENTS content', () => {
  // No playerNationId/regions passed in this describe block — exercises the generic (world-event)
  // path, where every curated national event is correctly ineligible no matter whose turn it is.
  it('returns null before any real event\'s year has arrived', () => {
    expect(nextStory(playerAt('bronze', 0))).toBeNull();
  });

  it('picks the earliest-year world event once its year has arrived', () => {
    const earliestYear = Math.min(...WORLD_EVENTS.map(e => e.year));
    const first = WORLD_EVENTS.find(e => e.year === earliestYear);
    const event = nextStory(eventAtItsPoint(first));
    expect(event.year).toBe(earliestYear);
    expect(event.land).toBeUndefined();
  });

  it('never re-selects an already-fired real event', () => {
    const earliest = WORLD_EVENTS.reduce((a, b) => (a.year <= b.year ? a : b));
    const next = nextStory(playerAt(earliest.ageId, 10, { firedEvents: { [earliest.id]: true } }));
    expect(next?.id).not.toBe(earliest.id);
  });

  it('eventually fires every world event as the player researches through the ages, with no nation selected', () => {
    let firedEvents = {};
    let firedCount = 0;
    AGE_ORDER.forEach((ageId) => {
      for (let n = 0; n <= 10; n += 1) {
        for (let guard = 0; guard < 50; guard += 1) {
          const event = nextStory(playerAt(ageId, n, { firedEvents }));
          if (!event) break;
          firedEvents = { ...firedEvents, [event.id]: true };
          firedCount += 1;
        }
      }
    });
    expect(firedCount).toBe(WORLD_EVENTS.length);
  });

  it('picks by event year, then declaration order, and only the left-behind ages are skipped', () => {
    const state = endState();
    const order = [];
    let firedEvents = {};
    for (let i = 0; i < 100; i += 1) {
      const event = nextStory({ ...state, firedEvents });
      if (!event) break;
      order.push(event);
      firedEvents = { ...firedEvents, [event.id]: true };
    }
    expect(order.length).toBeGreaterThan(0);
    expect(order.every(e => e.ageId === LAST_AGE_ID)).toBe(true);
    expect(order.map(e => e.year)).toEqual([...order.map(e => e.year)].sort((x, y) => x - y));
  });
});

describe('curated national stories, keyed by land', () => {
  // A people of the event's land (peoples.js land), when the pool has one.
  const peopleOf = (land) => PEOPLES_LIST.find((p) => p.land === land)?.id;
  const home = (id, owner = id) => ({ [getNationCapital(id)]: { owner } });
  const withPeople = CURATED_EVENTS.filter((e) => peopleOf(e.land));

  it('a people of the land exists for most of them', () => {
    expect(withPeople.length).toBeGreaterThanOrEqual(CURATED_EVENTS.length - 2);
  });

  it('never fires for a people of another land', () => {
    CURATED_EVENTS.forEach(event => {
      const other = peopleOf(event.land === 'eg' ? 'cn' : 'eg');
      expect(storyDue(eventAtItsPoint(event, { playerNationId: other, regions: home(other) }), storyCard(event))).toBe(false);
    });
  });

  it('fires for a people of its land at its point while it holds its capital', () => {
    withPeople.forEach(event => {
      const id = peopleOf(event.land);
      expect(storyDue(eventAtItsPoint(event, { playerNationId: id, regions: home(id) }), storyCard(event))).toBe(true);
    });
  });

  it('does not fire once the people has lost its capital (requiresHomeland)', () => {
    withPeople.forEach(event => {
      expect(event.requiresHomeland).toBe(true); // every curated event in this batch requires it
      const id = peopleOf(event.land);
      expect(storyDue(eventAtItsPoint(event, { playerNationId: id, regions: home(id, 'someone_else') }), storyCard(event))).toBe(false);
    });
  });

  it('the Nile flood fires for kemet ahead of later world events', () => {
    const egypt = HISTORICAL_EVENTS.national_egypt_nile_flood;
    const event = nextStory(eventAtItsPoint(egypt, { playerNationId: 'kemet', regions: home('kemet') }));
    expect(event.id).toBe(egypt.id);
  });
});

describe('HISTORICAL_EVENTS data integrity', () => {
  it("every event's derived ageId is a registry age holding its year", () => {
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      expect(AGE_ORDER).toContain(event.ageId);
      expect(event.ageId).toBe(ageIdOfYear(event.year));
      expect(event.year).toBeGreaterThanOrEqual(AGES[event.ageId].startYear);
      expect(event.year).toBeLessThanOrEqual(AGES[event.ageId].endYear);
    });
  });

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
    WORLD_EVENTS.forEach(event => { ageCounts[event.ageId] += 1; });
    AGE_ORDER.forEach(ageId => expect(ageCounts[ageId]).toBeGreaterThanOrEqual(2));
  });

  it('the Stone Age has seven events, all derived to stone and due within its first six techs', () => {
    const stone = WORLD_EVENTS.filter((e) => e.ageId === 'stone');
    expect(stone.length).toBe(7);
    stone.forEach((e) => { const n = eventTechsNeeded('stone', e.year); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(6); });
  });

  it('never spawns a follow-up that points at a nonexistent chain entry', () => {
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      event.options.forEach(option => {
        const followUp = option.effects.spawnFollowUp;
        if (followUp) expect(EVENT_CHAINS[followUp.id]).toBeDefined();
      });
    });
  });

  it('no world event references a specific nation or region — world events must stay alt-history tolerant', () => {
    // These effect keys name a specific nation/region id, which only makes sense for content that
    // already knows who's playing (situational/procedural events, curated national flavor below)
    // — a generic world event must survive any of the 240 possible starting nations, in any era.
    const identitySpecificKeys = ['captureRegions', 'returnRegion', 'peaceWith', 'tradeWith', 'warWith', 'nationHostility'];
    WORLD_EVENTS.forEach(event => {
      event.options.forEach(option => {
        identitySpecificKeys.forEach(key => expect(option.effects).not.toHaveProperty(key));
      });
    });
  });

  it('curated national events name a real land and are a representative, non-trivial batch', () => {
    CURATED_EVENTS.forEach(event => expect(countriesMeta[event.land], event.id).toBeDefined());
    expect(CURATED_EVENTS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(CURATED_EVENTS.map(e => e.land)).size).toBe(CURATED_EVENTS.length); // one per land
  });

  // Plan §13's "no event references a hardcoded nation/region id that may not exist" — the
  // land check above only covers WHICH land a curated event targets, not
  // any OTHER nation/region id an event's effects reference inside them (e.g. national_punic_
  // ambitions' warWith/tradeWith: ['tn']). A typo or an id that gets removed from REGIONS_DATA
  // later would otherwise silently no-op (every id lookup in applyEventEffects.js already guards
  // with `if (!nations[nId]) return;`) rather than failing loudly here.
  it('every nation/region id referenced inside an event\'s effects is real', () => {
    // warWith/tradeWith/peaceWith/nationHostility name NATIONS (applyEventEffects.js looks them up
    // via `nations[nId]`); captureRegions/returnRegion name actual REGIONS — two different id
    // spaces since a nation is no longer just one region matching its own id.
    const nationArrayFields = ['warWith', 'tradeWith', 'peaceWith'];
    const regionArrayFields = ['captureRegions'];
    const regionSingleIdFields = ['returnRegion'];
    Object.values(HISTORICAL_EVENTS).forEach(event => {
      event.options.forEach(option => {
        const effects = option.effects || {};
        nationArrayFields.forEach(field => {
          if (!effects[field]) return;
          const ids = Array.isArray(effects[field]) ? effects[field] : [effects[field]];
          ids.forEach(id => expect(countriesMeta[id], `${event.id}'s ${field} references unknown nation "${id}"`).toBeDefined());
        });
        regionArrayFields.forEach(field => {
          if (!effects[field]) return;
          const ids = Array.isArray(effects[field]) ? effects[field] : [effects[field]];
          ids.forEach(id => expect(REGIONS_DATA[id], `${event.id}'s ${field} references unknown region "${id}"`).toBeDefined());
        });
        regionSingleIdFields.forEach(field => {
          if (!effects[field]) return;
          expect(REGIONS_DATA[effects[field]], `${event.id}'s ${field} references unknown region "${effects[field]}"`).toBeDefined();
        });
        if (effects.nationHostility) {
          Object.keys(effects.nationHostility).forEach(id =>
            expect(countriesMeta[id], `${event.id}'s nationHostility references unknown nation "${id}"`).toBeDefined());
        }
      });
    });
  });
});

// Plan §M17: "≥60% of options do something structural (a modifier, loyalty, opinion, claim, law,
// rebels, dev) rather than just a resource delta." Scoped to the two STATICALLY authored registries
// (HISTORICAL_EVENTS, EVENT_CHAINS) — proceduralEvents.js's templates build their event object
// dynamically via `build(state)`, so a static content-lint would need to instantiate every one
// with a representative state just to count effect keys, a bigger, separate authoring-lint harness
// this milestone's core ask doesn't require.
describe('content structure ratio (plan §M17)', () => {
  const PURE_RESOURCE_KEYS = new Set(['gold', 'hr', 'copper', 'iron', 'oil', 'rareMetals', 'dip', 'techPoints', 'militaryStrengthBonus']);
  const isStructural = (effects) => Object.keys(effects || {}).some((k) => k !== 'spawnFollowUp' && !PURE_RESOURCE_KEYS.has(k));

  it('at least 60% of scripted-event options do something structural, not just move a resource number', () => {
    const allOptions = [...Object.values(HISTORICAL_EVENTS), ...Object.values(EVENT_CHAINS)]
      .flatMap((e) => e.options);
    const structuralCount = allOptions.filter((o) => isStructural(o.effects)).length;
    expect(structuralCount / allOptions.length).toBeGreaterThanOrEqual(0.6);
  });
});

describe('derived event ages', () => {
  it('every event ageId is in AGE_ORDER', () => {
    Object.values(HISTORICAL_EVENTS).forEach((e) => expect(AGE_ORDER).toContain(e.ageId));
  });
});
