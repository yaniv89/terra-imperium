// The Stone Age's village and first-cities phases (eight-ages plan U25).
import { describe, it, expect } from 'vitest';
import { stonePhaseOf, stonePhaseCtx, settleKey, FIRST_CITIES_TECHS, VILLAGE_SIZE_CAP, WRITING_TECH, NO_WRITING_COST_MULT, VILLAGE_LAW_CATEGORIES } from './stonePhase';
import { withTechsResearched, getResearchCost } from './research';
import { getAvailableGovernmentTypes } from '../data/government';
import { LAW_CATEGORIES, canEnactLaw } from '../data/laws';
import { cityYields, allocateTiles } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { peoplesWorld } from './testWorld';

const S = peoplesWorld({ seed: 7 });
const ME = S.playerNationId;
const cities = withTechsResearched(S, ME, FIRST_CITIES_TECHS);

describe('Stone Age phases (U25)', () => {
  it('a village becomes a land of first cities with Agriculture and Chiefdoms, and has no phase after the Stone Age', () => {
    expect(stonePhaseOf(S, ME)).toBe('village');
    expect(stonePhaseOf(withTechsResearched(S, ME, FIRST_CITIES_TECHS.slice(0, 1)), ME)).toBe('village');
    expect(stonePhaseOf(cities, ME)).toBe('cities');
    expect(stonePhaseOf(peoplesWorld({ seed: 7, age: 'bronze' }), ME)).toBeNull();
  });

  it('a farming village stops at VILLAGE_SIZE_CAP; a forager keeps the hearth cap; the first cities have none', () => {
    expect(stonePhaseCtx(withTechsResearched(S, ME, FIRST_CITIES_TECHS.slice(0, 1)), ME).maxSize).toBe(VILLAGE_SIZE_CAP);
    expect(stonePhaseCtx(withTechsResearched(S, ME, FIRST_CITIES_TECHS.slice(1)), ME).maxSize).toBeUndefined();
    expect(stonePhaseCtx(cities, ME).maxSize).toBeUndefined();
  });

  it('the settle wording says village in the village phase, city after it', () => {
    expect(settleKey(S, ME, 'mx.tile.foundHere')).toBe('mx.tile.foundHereVillage');
    expect(settleKey(cities, ME, 'mx.tile.foundHere')).toBe('mx.tile.foundHere');
  });

  it('a village is offered only Tribal; the first cities open Monarchy', () => {
    expect(getAvailableGovernmentTypes('stone', {}, 'village').map((t) => t.id)).toEqual(['tribal']);
    expect(getAvailableGovernmentTypes('stone', {}, 'cities').map((t) => t.id)).toContain('monarchy');
  });

  it('a village enacts land and justice laws only', () => {
    // every law's tech known, the age still Stone (two Stone techs are far from the six that move it on)
    const lawTechs = Object.values(LAW_CATEGORIES).flat().map((l) => l.requiresTech).filter(Boolean);
    const open = (s) => Object.entries(LAW_CATEGORIES).flatMap(([c, laws]) => laws.filter((l) => canEnactLaw(withTechsResearched(s, ME, lawTechs), ME, c, l.id)).map(() => c));
    expect(open(cities).some((c) => !VILLAGE_LAW_CATEGORIES.includes(c))).toBe(true);
    expect(open(S).length).toBeGreaterThan(0);
    expect(open(S).every((c) => VILLAGE_LAW_CATEGORIES.includes(c))).toBe(true);
  });

  it('research costs double until Proto-Writing', () => {
    const tech = 'military_hunting_bands';
    const known = withTechsResearched(S, ME, ['governance_chiefdoms', 'governance_sacred_kingship']); // past the opening discount (research.js)
    expect(getResearchCost(known, ME, tech)).toBe(getResearchCost(withTechsResearched(known, ME, [WRITING_TECH]), ME, tech) * NO_WRITING_COST_MULT);
  });

  it('the first cities eat one more food from each river tile they work', () => {
    const tiles = getTiles();
    const city = S.regions[S.nations[ME].capitalRegionId];
    const world = { cities: S.regions, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const worked = allocateTiles(city, tiles, world, []);
    const rivers = worked.filter((t) => tiles.rivers[t]).length;
    expect(rivers).toBeGreaterThan(0);
    const before = cityYields(city, tiles, world, worked, [], {}).food;
    expect(cityYields(city, tiles, world, worked, [], stonePhaseCtx(cities, ME)).food).toBeCloseTo(before + rivers, 5);
  });
});
