// Estates on the map (plan C4.2): the countryside split by crown land and influence, the estates'
// take and give, the privileges that grant land, the lens.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { resolveTurn } from './resolveTurn';
import { estateHoldings, estateLandEffects, describeHoldings, estatePreference, ESTATE_TILE_GOLD_SHARE, NOBLE_LEVY_PER_TILE, CLERGY_CULTURE_PER_TILE, ESTATE_LAND_MIN_COUNTRYSIDE } from './estateLand';
import { estateTints } from '../components/map/lenses';
import { calcIncome } from '../utils/helpers';
import { getNationCapital } from '../data/regions';
import { addCities } from './testWorld';
import { tileFacts } from '../data/tileYields';
import { getTiles } from '../data/geo/tiles';

// Five Australian cities (Dawn Europe is too crowded to grow), each grown over its free land
// within two rings (a Dawn city owns a few tiles; the estates take land from
// ESTATE_LAND_MIN_COUNTRYSIDE tiles on).
const grow = (state) => {
  const tiles = getTiles();
  const regions = { ...state.regions }; const tileOwner = { ...state.world.tileOwner };
  Object.values(regions).forEach((c) => {
    if (c.owner !== 'au') return;
    const ring2 = [...new Set(tiles.neighbors[c.tile].flatMap((t) => [t, ...tiles.neighbors[t]]))];
    const extra = ring2.filter((t) => t !== c.tile && tiles.land[t] === 1 && tileOwner[t] == null);
    extra.forEach((t) => { tileOwner[t] = c.id; });
    regions[c.id] = { ...c, tiles: [...new Set([...c.tiles, ...extra])] };
  });
  return { ...state, regions, world: { ...state.world, tileOwner } };
};
const base = () => grow(addCities(createInitialState({ playerNationId: 'au', rngSeed: 9 }), 'au', 4).state);
const withCrown = (s, crownLand) => ({ ...s, nations: { ...s.nations, au: { ...s.nations.au, crownLand } } });
const workedAll = (s) => ({ ...s, regions: Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === 'au' ? { ...c, worked: c.tiles.filter((t) => t !== c.tile) } : c])) });

describe('estateHoldings', () => {
  it('splits the countryside: crown land share to the crown, the rest by influence, nothing at 100%', () => {
    const s = base();
    const h = estateHoldings(s);
    expect(h.countryside).toBeGreaterThan(5);
    const estateTiles = Object.values(h.byEstate).reduce((n, list) => n + list.length, 0);
    expect(h.byTile.size).toBe(estateTiles);
    expect(h.crownTiles + estateTiles).toBe(h.countryside);
    expect(Math.abs(estateTiles - Math.round(h.countryside * 0.5))).toBeLessThanOrEqual(2);
    expect(estateHoldings(withCrown(s, 100)).byTile.size).toBe(0);
    expect(estateHoldings(withCrown(s, 0)).byTile.size).toBeGreaterThanOrEqual(h.countryside - 3); // per-estate rounding
    expect(estateHoldings(s)).toBe(h); // memoised
  });
  it('a Dawn chiefdom has no landed estates: under the minimum countryside the crown works it all', () => {
    const s = createInitialState({ playerNationId: 'au', rngSeed: 9 });
    const h = estateHoldings(s);
    expect(h.countryside).toBeLessThan(ESTATE_LAND_MIN_COUNTRYSIDE);
    expect(h.byTile.size).toBe(0); expect(h.crownTiles).toBe(h.countryside);
    expect(estateLandEffects(s).goldToEstates).toBe(0);
  });
  it('a land privilege adds a tenth of the countryside to that estate', () => {
    const s = base();
    const before = estateHoldings(s).byEstate.nobility.length;
    const granted = { ...s, nations: { ...s.nations, au: { ...s.nations.au, estates: { ...s.nations.au.estates, nobility: { ...s.nations.au.estates.nobility, privileges: ['landed_estates'] } } } } };
    const after = estateHoldings(granted).byEstate.nobility.length;
    expect(after - before).toBeGreaterThanOrEqual(Math.round(estateHoldings(s).countryside * 0.1) - 1);
  });
  it('each estate takes the tiles it prefers first', () => {
    const s = base(); const tiles = getTiles();
    const h = estateHoldings(s);
    const pref = (t) => estatePreference(tileFacts(tiles, t, s.world.tileState[t]));
    ['nobility', 'clergy', 'burghers'].forEach((id) => {
      if (!h.byEstate[id]?.length) return;
      const minTaken = Math.min(...h.byEstate[id].map((t) => pref(t)[id]));
      const crown = [...Array(h.countryside).keys()].length ? [] : [];
      void crown;
      // No crown tile that this estate would prefer more was left while a lesser one was taken,
      // among the tiles that were still free when this estate chose (earlier estates pick first).
      const earlier = ['nobility', 'clergy', 'burghers'].slice(0, ['nobility', 'clergy', 'burghers'].indexOf(id)).flatMap((e) => h.byEstate[e] || []);
      const free = Object.values(s.regions).filter((c) => c.owner === 'au').flatMap((c) => c.tiles.filter((t) => t !== c.tile && tiles.land[t] === 1)).filter((t) => !earlier.includes(t) && !h.byEstate[id].includes(t));
      expect(free.every((t) => pref(t)[id] <= minTaken)).toBe(true);
    });
  });
});

describe('the estates take and give', () => {
  it('worked estate tiles pay half their gold; the nobility returns levies, the clergy culture', () => {
    const s = workedAll(base());
    const e = estateLandEffects(s);
    const h = estateHoldings(s);
    expect(e.levies).toBe((h.worked.nobility || 0) * NOBLE_LEVY_PER_TILE);
    const clergy = Object.values(e.cultureByCity).reduce((a, b) => a + b, 0);
    expect(clergy).toBeCloseTo((h.worked.clergy || 0) * CLERGY_CULTURE_PER_TILE, 6);
    expect(e.goldToEstates).toBeGreaterThanOrEqual(0);
    // Against the same nation with no estates at all (crown land 100 would also move the crown-land modifier line).
    const none = calcIncome({ ...s, nations: { ...s.nations, au: { ...s.nations.au, estates: {} } } }); const shared = calcIncome(s);
    expect(Math.abs((none.gold - shared.gold) - (e.goldToEstates - e.tradeGold))).toBeLessThanOrEqual(1); // the income total is rounded
    expect(shared.hr - none.hr).toBe(e.levies);
    expect(ESTATE_TILE_GOLD_SHARE).toBe(0.5);
    expect(describeHoldings(s).map((l) => l.estateId)).toEqual(Object.keys(h.byEstate));
  });
  it('the clergy culture reaches the city through a turn', () => {
    const s = workedAll(base());
    const e = estateLandEffects(s);
    const [city, culture] = Object.entries(e.cultureByCity).sort((a, b) => b[1] - a[1])[0] || [];
    if (!city) return;
    const quiet = { ...s, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const withClergy = resolveTurn(quiet).regions[city].lastYields.culture;
    const crownOnly = resolveTurn(withCrown(quiet, 100)).regions[city].lastYields.culture;
    expect(withClergy - crownOnly).toBeCloseTo(culture, 1);
  });
  it('the lens tints every held tile with its estate', () => {
    const s = base();
    const tints = estateTints(s);
    expect(tints.length).toBe(estateHoldings(s).byTile.size);
    tints.forEach((t) => expect(estateHoldings(s).byTile.get(t.tile)).toBe(t.estateId));
    expect(getNationCapital('au')).toBeTruthy();
  });
});
