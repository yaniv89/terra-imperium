import { describe, it, expect } from 'vitest';
import { getNeighborIds } from '../data/regions';
import { neighbourWorld, rivalOf, majorIds } from './testWorld';
import { buildingOrder, BUILDING_PRIORITY, chooseProduction } from './aiProduction';
import { DOCTRINE_BUILDING_PRIORITY, DOCTRINE_IDS } from '../data/nations';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { getTiles } from '../data/geo/tiles';
import { RESOURCES_ON_TILES, tileFacts, canImprove } from '../data/tileYields';

// A world where the rival's capital borders the player's land.
const W = neighbourWorld({ seed: 3, rivals: 1, capitals: true });
const D = rivalOf(W);
const P = W.playerNationId;
// A people that does not border the rival's capital, so a war with it does not threaten the city.
const FAR = majorIds(W).find((id) => id !== P && id !== D && !getNeighborIds(W.nations[D].capitalRegionId).some((n) => W.regions[n]?.owner === id));

describe('AI building templates (the doctrine order)', () => {
  it('every doctrine orders every line once, its own preferences first', () => {
    DOCTRINE_IDS.forEach((d) => {
      const order = buildingOrder(d);
      expect([...order].sort()).toEqual([...BUILDING_PRIORITY].sort());
      const liked = DOCTRINE_BUILDING_PRIORITY[d].filter((c) => BUILDING_PRIORITY.includes(c));
      expect(order.slice(0, liked.length)).toEqual(liked);
    });
    expect(buildingOrder(undefined)).toEqual(BUILDING_PRIORITY);
  });
  it('a blitz city builds its first military line before food; a cautious one builds defense first', () => {
    const s = W;
    const berlin = s.regions[s.nations[D].capitalRegionId];
    const rich = { ...berlin, lastYields: { ...(berlin.lastYields || {}), production: 30 }, production: { current: null, queue: [], progress: 0 } };
    const pick = (doctrine) => {
      const st = { ...s, regions: { ...s.regions, [berlin.id]: rich }, nations: { ...s.nations, [D]: { ...s.nations[D], doctrine, ruler: { ...s.nations[D].ruler, traits: [] } } } }; // a ruler without traits: the doctrine order alone (rulerBias.js)
      return chooseProduction(st, rich, { researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: 2, units: s.units, counts: { settlers: 1, outposts: 0, landUnits: 9 } });
    };
    const blitz = pick('blitz'); const cautious = pick('cautious');
    expect(blitz.kind).toBe('building'); expect(cautious.kind).toBe('building');
    expect(blitz.category).toBe(DOCTRINE_BUILDING_PRIORITY.blitz.find((c) => BUILDING_CATEGORIES[c]?.tiers[0] && !BUILDING_CATEGORIES[c].tiers[0].requiresTech && !BUILDING_CATEGORIES[c].coastalOnly));
    expect(cautious.category).toBe(DOCTRINE_BUILDING_PRIORITY.cautious.find((c) => BUILDING_CATEGORIES[c]?.tiers[0] && !BUILDING_CATEGORIES[c].tiers[0].requiresTech && !BUILDING_CATEGORIES[c].coastalOnly));
  });
});

describe('AI production by utility (plans/math/ai.md)', () => {
  const setup = (doctrine, cityPatch = {}, extra = {}) => {
    const s = W;
    const berlin = s.regions[s.nations[D].capitalRegionId];
    const city = { ...berlin, lastYields: { ...(berlin.lastYields || {}), production: 30, food: 2 }, production: { current: null, queue: [], progress: 0 }, ...cityPatch };
    const st = { ...s, regions: { ...s.regions, [berlin.id]: city }, nations: { ...s.nations, [D]: { ...s.nations[D], doctrine, economy: { ...s.nations[D].economy, gold: 5000 }, ruler: { ...s.nations[D].ruler, traits: [] } } }, ...extra };
    return { st, city };
  };
  const ctx = (st, landUnits = 9) => ({ researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: 2, units: st.units, counts: { settlers: 1, outposts: 0, landUnits } });

  it('a starving city builds food before its doctrine\'s first line', () => {
    const { st, city } = setup('cautious', { lastYields: { production: 30, food: -1 } });
    expect(chooseProduction(st, city, ctx(st))).toMatchObject({ kind: 'building', category: 'food' });
  });
  it('a city touching an enemy at war builds walls first, even for a blitz doctrine', () => {
    const { st: s0, city } = setup('blitz');
    const enemyId = getNeighborIds(city.id).map((id) => s0.regions[id]?.owner).find((o) => o && o !== D);
    const st = { ...s0, wars: [{ id: 'w', active: true, aggressor: enemyId, enemy: D }] };
    expect(chooseProduction(st, city, ctx(st))).toMatchObject({ kind: 'building', category: 'defense' });
  });
  it('at war, a nation short of armies trains them before buildings; in peace it builds first', () => {
    const { st: s0, city } = setup('attrition');
    const war = { ...s0, wars: [{ id: 'w', active: true, aggressor: FAR, enemy: D }] };
    expect(chooseProduction(war, city, ctx(war, 0))).toMatchObject({ kind: 'unit' });
    expect(chooseProduction(s0, city, ctx(s0, 0)).kind).toBe('building');
  });
  it('from Modern an army at war keeps a share of aircraft beside its archers (U57)', () => {
    const { st: s0, city } = setup('attrition');
    const war = { ...s0, wars: [{ id: 'w', active: true, aggressor: FAR, enemy: D }] };
    const late = (air) => ({ ...ctx(war, 6), ageId: 'information', citiesOwned: 10, counts: { settlers: 1, outposts: 0, landUnits: 6, ranged: 2, air } });
    expect(chooseProduction(war, city, late(0))).toMatchObject({ kind: 'unit', classId: 'air' });
    expect(chooseProduction(war, city, late(2))).toMatchObject({ kind: 'unit', classId: 'infantry' });
  });
});

describe('AI resource improvements (lane W6)', () => {
  it('a city builds the improvement its resource needs, worked tiles first, and not twice', () => {
    const tiles = getTiles();
    const s = W;
    // A city of an AI nation with a resource tile on its land whose improvement needs no technology.
    let found = null;
    for (const c of Object.values(s.regions)) {
      if (!c.owner || c.owner === P || !c.tiles?.length) continue;
      const t = c.tiles.find((x) => { const r = RESOURCES_ON_TILES[tiles.resourceOf(x)]; return r && x !== c.tile && canImprove(tileFacts(tiles, x, {}), r.improvement, []); });
      if (t != null) { found = { c, t }; break; }
    }
    expect(found).not.toBe(null);
    const { c, t } = found;
    const imp = RESOURCES_ON_TILES[tiles.resourceOf(t)].improvement;
    const city = { ...c, worked: [t], lastYields: { production: 6, food: 2 }, production: { current: null, queue: [], progress: 0 } };
    const st = { ...s, world: { ...s.world, tileState: {} }, regions: { ...s.regions, [c.id]: city } };
    const ctx = { researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: 2, units: st.units, counts: { settlers: 1, outposts: 0, landUnits: 9 } };
    expect(chooseProduction(st, city, ctx)).toEqual({ kind: 'improvement', improvement: imp, tile: t });
    const built = { ...st, world: { ...st.world, tileState: { [t]: { improvement: imp } } } };
    expect(chooseProduction(built, city, ctx)).not.toMatchObject({ kind: 'improvement', tile: t });
  });
});

describe('a restless city wants Culture & Order (lane W6)', () => {
  it('the need rises with unrest up to UNREST_NEED', async () => {
    const { lineNeed, UNREST_NEED, UNREST_NEED_AT } = await import('./aiProduction');
    const sit = { atWar: false, arming: false, broke: false, threatened: false };
    expect(lineNeed('culture', { unrest: 0 }, sit)).toBe(1);
    expect(lineNeed('culture', { unrest: UNREST_NEED_AT / 2 }, sit)).toBeCloseTo(1 + (UNREST_NEED - 1) / 2, 6);
    expect(lineNeed('culture', { unrest: 90 }, sit)).toBe(UNREST_NEED);
  });
});
