// Agricultural hearths and forage (eight-ages plan U24).
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { AGRICULTURE_TECH, FORAGE_SIZE_CAP, hearthOfTile, hearthAt, forageCtx } from '../data/hearths';
import { getResearched } from './nationState';
import { withTechsResearched } from './research';
import { peoplesWorld, majorIds } from './testWorld';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });

describe('hearths and forage (U24)', () => {
  it('finds the hearth of a place', () => {
    expect(hearthAt({ lat: 32.5, lon: 44.4 })?.id).toBe('fertile_crescent'); // Kish
    expect(hearthAt({ lat: 51.5, lon: -0.1 })).toBeNull(); // London
    expect(forageCtx([])).toEqual({ maxSize: FORAGE_SIZE_CAP });
    expect(forageCtx([AGRICULTURE_TECH])).toEqual({});
  });

  it('a hearth people starts with Agriculture, a people elsewhere does not', () => {
    const s = peoplesWorld({ seed: 7 });
    const tiles = getTiles();
    const homeOf = (id) => s.regions[s.nations[id].capitalRegionId].tile;
    const ids = majorIds(s);
    const hearth = ids.filter((id) => hearthOfTile(tiles, homeOf(id)));
    const elsewhere = ids.filter((id) => !hearthOfTile(tiles, homeOf(id)));
    expect(hearth.length).toBeGreaterThan(0);
    expect(elsewhere.length).toBeGreaterThan(0);
    hearth.forEach((id) => expect(getResearched(s, id), id).toContain(AGRICULTURE_TECH));
    elsewhere.forEach((id) => expect(getResearched(s, id), id).not.toContain(AGRICULTURE_TECH));
    hearth.forEach((id) => expect(s.regions[s.nations[id].capitalRegionId].size, id).toBe(2));
  });

  it(`a village with no Agriculture stops at size ${FORAGE_SIZE_CAP}; with it, it grows`, () => {
    const s = quiet(peoplesWorld({ seed: 7 }));
    const id = majorIds(s).find((n) => n !== s.playerNationId && !getResearched(s, n).includes(AGRICULTURE_TECH));
    const cap = s.nations[id].capitalRegionId;
    const full = { ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], size: FORAGE_SIZE_CAP, food: 1e6, focus: 'food' } } }; // a food surplus at size 3: no central-place food in the Stone Age (market.js)
    expect(resolveTurn(full).regions[cap].size).toBe(FORAGE_SIZE_CAP);
    expect(resolveTurn(withTechsResearched(full, id, [AGRICULTURE_TECH])).regions[cap].size).toBe(FORAGE_SIZE_CAP + 1);
  });
});
