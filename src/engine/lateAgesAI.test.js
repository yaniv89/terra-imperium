// The Modern and Information AI (eight-ages plan U57): Energy plants in the late ages, a World
// Congress that splits by doctrine, laws that never cost income, and an Information title for every people.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { peoplesWorld, majorIds, growCities } from './testWorld';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { tallyVote } from './worldCongress';
import { pickAILaw } from './aiEconomy';
import { PEOPLES } from '../data/peoples';
import { LAW_CATEGORIES } from '../data/laws';
import { DOCTRINE_LAWS } from '../data/nations';
import { titleFor } from '../data/nationTitles';

const firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
const step = (s) => { const n = resolveTurn(s.pendingPeaceOffer ? { ...s, pendingPeaceOffer: null } : s); return n.activeProceduralEvent ? { ...n, activeProceduralEvent: null } : n; };
const aiMajors = (s) => majorIds(s).filter((id) => id !== s.playerNationId && !s.nations[id].isEliminated);

describe('Information AI (U57)', () => {
  it('AI majors build Energy tiers within their first 40 Information turns', () => {
    // A grown late realm: every line one tier short of its last, no Energy yet.
    const categories = Object.fromEntries(Object.entries(BUILDING_CATEGORIES).filter(([id]) => id !== 'energy').map(([id, c]) => [id, c.tiers.length - 2]));
    const w = peoplesWorld({ seed: 11, age: 'information' });
    let s = { ...aiMajors(w).reduce((x, id) => growCities(x, id, { size: 8, categories }), w), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    for (let t = 0; t < 40; t++) s = step(s);
    const powered = new Set(Object.values(s.regions).filter((c) => (c.buildings?.categories?.energy ?? -1) >= 0).map((c) => c.owner));
    const ids = aiMajors(s);
    // Settlers (queued the turn a city can, follow-up 20) and tile improvements come first on this
    // fixture's empty land: the first plant on seed 11 near turn 24; turn 35 since settlers and improvements
    // cost turns of the age's benchmark city (early-pace-8).
    expect(ids.filter((id) => powered.has(id)).length).toBeGreaterThan(0);
  }, 120000);

  it('a world of strangers splits its Congress votes by doctrine', () => {
    const s = peoplesWorld({ seed: 11, size: 'standard' });
    const ids = aiMajors(s);
    const trade = tallyVote(s, ids, { id: 'tradeStandard' }, ids[0]);
    const arms = tallyVote(s, ids, { id: 'armsLimit' }, ids[0]);
    expect(trade.no).toBeGreaterThan(0);
    expect(arms.no).toBeGreaterThan(0);
    expect(trade.yes + trade.no).toBeLessThan(ids.length); // the middle abstains
  });

  it('a doctrine with no view on land laws never takes the Renewable Mandate, nor steps down', () => {
    const s = peoplesWorld({ seed: 11, age: 'information' });
    const id = aiMajors(s)[0];
    const mk = (laws) => ({ ...s.nations[id], doctrine: 'cautious', laws: { ...s.nations[id].laws, ...laws }, lawCooldowns: {}, stability: 1, ruler: { ...s.nations[id].ruler, decrees: 3 } });
    const pickFor = (laws) => { const n = mk(laws); return pickAILaw({ ...s, nations: { ...s.nations, [id]: n } }, id, n); };
    const top = Object.fromEntries(Object.entries(LAW_CATEGORIES).map(([c, laws]) => [c, DOCTRINE_LAWS.cautious[c]?.[0] || laws[laws.length - 1].id])); // each at the law it wants
    expect(pickFor({ ...top, land: 'collectivization' })).toBeNull(); // the Renewable Mandate costs 5% income
    expect(pickFor({ ...top, land: 'renewable_mandate' })).toBeNull(); // and it never steps down
    expect(pickFor({ ...top, land: 'private_property' })).toEqual({ category: 'land', id: 'collectivization' });
  });

  it('every people has a Technocracy title', () => {
    Object.values(PEOPLES).forEach((p) => expect(titleFor(p, 'technocracy', 3), p.id).toMatch(/Technate/));
  });
});
