import { describe, it, expect } from 'vitest';
import { drawCard, noteEventFired, cooldownTurns, storyDue, storyCard } from '../engine/eventDeck';
import { HISTORICAL_EVENTS } from './events';
import { createRng } from '../utils/rng';
import { getNationCapital } from './regions';
import { getTechsForAge } from './techTree';
import { getTiles } from './geo/tiles';
import { peoplesWorld } from '../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 5 });
const EG = WORLD.playerNationId;

// Playtest audit I221 (cooldowns), I222 (context prerequisites), I223 (Bronze Age Collapse).
describe('procedural events: context and cooldowns', () => {
  const run = (state, n = 80) => Array.from({ length: n }, (_, seed) => drawCard(state, createRng(seed))).filter(Boolean);
  const unprepared = (state) => ({ ...state, regions: Object.fromEntries(Object.entries(state.regions).map(([id, c]) => [id, { ...c, climateResilience: 0 }])) });

  it('never gives a harsh winter to a hot river city', () => {
    const state = peoplesWorld({ seed: 5 });
    expect(run(unprepared(state)).some((e) => e.templateId === 'harsh_winter')).toBe(false);
  });

  it('only talks about granaries in a city that has one', () => {
    const state = unprepared(peoplesWorld({ seed: 5 }));
    const capId = getNationCapital(EG);
    const city = state.regions[capId];
    const food = (tier) => ({ ...state, regions: { ...state.regions, [capId]: { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, food: tier } } } } });
    const text = (s) => run(s, 150).filter((e) => e.cityId === capId && ['river_flood', 'failed_harvest'].includes(e.templateId)).map((e) => e.description).join(' ');
    expect(text(food(-1))).not.toMatch(/granar/i);
    expect(text(food(0))).toMatch(/granar/i);
  });

  it('rests a template, its family and its city after it fires, and the rest scales with the speed table', () => {
    const state = { ...peoplesWorld({ seed: 5 }), turnNumber: 40 };
    const first = run(state, 10)[0];
    expect(first).toBeTruthy();
    const history = noteEventFired({}, first, 40);
    expect(history[`t:${first.templateId}`]).toBe(40);
    const soon = run({ ...state, turnNumber: 41, eventHistory: history }, 60);
    expect(soon.some((e) => e.templateId === first.templateId)).toBe(false);
    expect(soon.some((e) => e.family === first.family)).toBe(false);
    expect(soon.some((e) => e.cityId === first.cityId)).toBe(false);
    const normal = cooldownTurns({ gameSpeed: 'normal', age: 'bronze' }, 'template');
    const marathon = cooldownTurns({ gameSpeed: 'marathon', age: 'bronze' }, 'template');
    expect(marathon).toBeGreaterThan(normal);
    const later = run({ ...state, turnNumber: 40 + marathon + 1, eventHistory: history }, 60);
    expect(later.some((e) => e.templateId === first.templateId)).toBe(true);
  });

  it('works for a save without an event history', () => {
    const state = peoplesWorld({ seed: 5 });
    delete state.eventHistory;
    expect(() => run(state, 5)).not.toThrow();
  });
});

describe('scripted events: prerequisites', () => {
  const city = (owner, tile) => ({ owner, tile });
  // A Bronze Age player holding the techs the nominal year marks: round(6 x (year + 2000) / 1200).
  const at = (year, regions) => {
    const techs = getTechsForAge('bronze').slice(0, Math.round(6 * (year + 2000) / 1200));
    return { playerNationId: 'p', techAgeId: 'bronze', techTree: Object.fromEntries(techs.map((x) => [x.id, { researched: true }])), nations: {}, firedEvents: {}, regions };
  };
  it('holds the Bronze Age Collapse for a realm of three cities until the age ends', () => {
    const ev = HISTORICAL_EVENTS.bronze_age_collapse;
    const one = { a: city('p', 1) };
    const three = { a: city('p', 1), b: city('p', 2), c: city('p', 3) };
    expect(storyDue(at(-1200, one), storyCard(ev))).toBe(false);
    expect(storyDue(at(-1200, three), storyCard(ev))).toBe(true);
    expect(storyDue(at(-900, one), storyCard(ev))).toBe(true);
  });

  it('keeps sea raids away from a player with no coastal city', () => {
    const ev = HISTORICAL_EVENTS.sea_peoples_invasions;
    const t = getTiles();
    let inland = -1; let coast = -1;
    for (let i = 0; i < t.count && (inland < 0 || coast < 0); i++) {
      if (t.land[i] !== 1) continue;
      if (t.coastal[i] === 1 && coast < 0) coast = i;
      if (t.coastal[i] !== 1 && inland < 0) inland = i;
    }
    expect(storyDue(at(-1100, { a: city('p', inland) }), storyCard(ev))).toBe(false);
    expect(storyDue(at(-1100, { a: city('p', coast) }), storyCard(ev))).toBe(true);
  });
});
