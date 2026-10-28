// The settle mode, the settlers' roads and what the site card says (playtest audit I054, I056,
// I057, I084 to I096): settleMode.js, settleRoutes.js, settleSiteModel.js, tileYields.resourceKnown.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { makeSettler, bestSites, canSettle, siteOutlook, SETTLER_MOVES, MAX_SETTLE_RINGS } from '../../engine/settlers';
import { isExplored } from '../../engine/fog';
import { ringDistance } from '../../engine/world/cities';
import { resourceKnown } from '../../data/tileYields';
import { citySpacingRings } from '../../data/geo/citySpacing';
import { nextPrompts } from '../ui/nextPromptModel';
import { emptyBits } from '../../engine/fog';
import { settleModeFor, settleModeOver, settleSites, settleUnit, nextSite, settleBarModel, idleSettlerOn, firstIdleSettler } from './settleMode';
import { settlerLines, settlerRoad, settlerEta, settlerStatus } from './settleRoutes';
import { settleSiteModel, spacingRule, SITE_WARNING_TEXT } from './settleSiteModel';
import { lensShapes, marchShapes, MARCH_LINE_PX, glyphScale, GLYPH_MAX_SCALE } from './gl/sceneModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;
const capital = base.regions[base.nations[me].capitalRegionId];
const withSettler = (patch = {}) => ({ ...base, units: { ...base.units, u_set: { ...makeSettler('u_set', capital, me), ...patch } } });
const projection = (ll) => [ll[0] * 2, -ll[1] * 2];
projection.scale = () => 360 / Math.PI;

describe('the settle mode', () => {
  it('starts for a settler that waits, on its tile or the first of them, never for an army or a tile without one', () => {
    const s = withSettler();
    expect(idleSettlerOn(s, capital.tile)?.id).toBe('u_set');
    expect(firstIdleSettler(s)?.id).toBe('u_set');
    expect(idleSettlerOn(s, null)).toBeNull();
    expect(idleSettlerOn(base, capital.tile)).toBeNull();
    expect(settleModeFor(null)).toBeNull();
    // settlers told to wait are not offered by "Show good sites", but can be tapped
    const held = withSettler({ hold: true });
    expect(firstIdleSettler(held)).toBeNull();
    expect(idleSettlerOn(held, capital.tile)?.id).toBe('u_set');
  });

  it('lists ranked sites that are legal, explored and reachable, the sound ones first', () => {
    const s = withSettler();
    const mode = settleModeFor(s.units.u_set);
    const sites = settleSites(s, mode);
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((site) => {
      expect(canSettle(s, site.tile, me, 'bronze').ok).toBe(true);
      expect(isExplored(s, site.tile, me)).toBe(true); // never land under the fog
      expect(site.turns).toBe(Math.max(1, Math.ceil(site.steps / SETTLER_MOVES)));
      expect(site.steps).toBeLessThanOrEqual(MAX_SETTLE_RINGS);
    });
    const firstPoor = sites.findIndex((x) => x.warnings.length > 0);
    if (firstPoor >= 0) sites.slice(firstPoor).forEach((x) => expect(x.warnings.length).toBeGreaterThan(0));
    // each is a place of its own: no two closer than two cities may stand
    const tiles = getTiles();
    sites.forEach((a, i) => sites.slice(i + 1).forEach((b) => expect(ringDistance(tiles, a.tile, b.tile, 12)).toBeGreaterThanOrEqual(citySpacingRings(tiles))));
    // the engine's own best site is among them, unless it is a poor one (short of food or
    // production) and the list is already full of sound sites, which come first (I098: with
    // fewer resources the top score can be a poor site)
    const best = bestSites(s, me, capital.tile, 'bronze', { rings: MAX_SETTLE_RINGS, limit: 1 })[0];
    const bestPoor = (siteOutlook(s, best.tile, me)?.warnings || []).length > 0;
    if (!bestPoor || sites.some((x) => x.warnings.length)) expect(sites.map((x) => x.tile)).toContain(best.tile);
    else expect(sites.every((x) => !x.warnings.length)).toBe(true);
  });

  it('"Next good site" walks the list round and starts at the best', () => {
    const sites = [{ tile: 5 }, { tile: 9 }, { tile: 2 }];
    expect(nextSite(sites, null).tile).toBe(5);
    expect(nextSite(sites, 5).tile).toBe(9);
    expect(nextSite(sites, 2).tile).toBe(5);
    expect(nextSite(sites, 777).tile).toBe(5); // a blocked tile was tapped in between
    expect(nextSite([], 5)).toBeNull();
  });

  it('survives taps and a closed sheet, and ends only when the settler has a site or is gone', () => {
    const s = withSettler();
    const mode = settleModeFor(s.units.u_set);
    expect(settleModeOver(s, mode)).toBe(false);
    expect(settleModeOver(s, null)).toBe(false);
    const site = settleSites(s, mode)[0];
    const sent = gameReducer(s, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: 'u_set', tile: site.tile } });
    expect(sent.units.u_set.target).toBe(site.tile);
    expect(settleModeOver(sent, mode)).toBe(true);
    const gone = gameReducer(s, { type: ActionTypes.DISBAND_SETTLERS, payload: { unitId: 'u_set' } });
    expect(settleModeOver(gone, mode)).toBe(true);
    expect(settleUnit(gone, mode)).toBeNull();
  });

  it('the bar says whose settlers they are and what the next tap does', () => {
    const s = withSettler();
    const mode = settleModeFor(s.units.u_set);
    const sites = settleSites(s, mode);
    const m = settleBarModel(s, mode, sites, null);
    expect(m.title).toBe(`Settlers of ${capital.name}`);
    expect(m.nextLabel).toBe('Best site');
    expect(settleBarModel(s, mode, sites, sites[0].tile).nextLabel).toBe(`Next good site (${sites.length > 1 ? 2 : 1} of ${sites.length})`);
    expect(settleBarModel(s, mode, [], null).nextLabel).toBeNull();
    expect(settleBarModel(s, mode, [], null).hint).toMatch(/No good site/);
    // no site in reach: Send home is offered (Opus playtest step 385), never while sites exist
    expect(settleBarModel(s, mode, [], null)).toMatchObject({ sendHome: true, unitId: 'u_set' });
    expect(settleBarModel(s, mode, sites, null).sendHome).toBe(false);
    // and such settlers leave the Idle count: an unexplored world has no site known in reach
    const prompts = (x) => nextPrompts(x).filter((p) => p.kind === 'settler').map((p) => p.id);
    expect(prompts(s)).toContain('settler:u_set');
    const blind = { ...s, fog: { ...s.fog, explored: { ...s.fog.explored, [s.playerNationId]: emptyBits() } } };
    expect(prompts(blind)).not.toContain('settler:u_set');
    expect(settleBarModel(base, mode, sites, null)).toBeNull();
  });

  it('draws its tints round the settler and a numbered mark on every ranked site', () => {
    const s = withSettler();
    const sites = settleSites(s, settleModeFor(s.units.u_set));
    const out = lensShapes({ state: s, projection, k: 400, lens: 'settle', dpr: 1, settlerTile: capital.tile, sites: sites.map((x) => ({ tile: x.tile, poor: x.warnings.length > 0 })) });
    expect(out.tints.length).toBeGreaterThan(50);
    sites.forEach((x) => expect(out.tints.find((t) => t.tile === x.tile)?.ok).toBe(true)); // every ranked site is inside the tinted land
    expect(out.sprites.filter((sp) => sp.art.key.startsWith('label|')).map((sp) => sp.art.key.split('|')[1])).toEqual(sites.map((_, i) => String(i + 1)));
    // marks keep their size on screen at every zoom
    out.sprites.forEach((sp) => expect(sp.exp).toEqual([0, 0]));
    // without a settler the lens is the passive one
    expect(lensShapes({ state: s, projection, k: 2, lens: 'settle', dpr: 1 }).sprites).toHaveLength(0);
    expect(lensShapes({ state: s, projection, k: 2, lens: 'political', dpr: 1, settlerTile: capital.tile }).tints).toBeNull();
  });
});

describe('settlers on the road', () => {
  it('a settler with a destination has a line with its turns, one that waits has none', () => {
    const s = withSettler();
    expect(settlerLines(s)).toEqual([]);
    const site = settleSites(s, settleModeFor(s.units.u_set))[0];
    const sent = gameReducer(s, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: 'u_set', tile: site.tile } });
    const [line] = settlerLines(sent);
    expect(line.kind).toBe('settlers');
    expect(line.points[0]).toBe(capital.tile);
    expect(line.points[line.points.length - 1]).toBe(site.tile);
    expect(line.marks[line.marks.length - 1].turn).toBe(settlerEta(sent, sent.units.u_set));
    expect(settlerRoad(sent, sent.units.u_set)).toHaveLength(line.points.length - 1);
    // a thin dashed line of one width at every zoom
    const far = marchShapes({ marchLines: [line], projection, k: 1, selectedArmy: null, dpr: 1 });
    const near = marchShapes({ marchLines: [line], projection, k: 16, selectedArmy: null, dpr: 1 });
    expect(Math.max(...far.lines.map((l) => l.half))).toBeLessThanOrEqual(MARCH_LINE_PX + 1);
    expect(near.lines.every((l) => l.exp === 0)).toBe(true);
    expect(near.lines.some((l) => l.dash > 0)).toBe(true);
    expect(near.sprites.some((sp) => /turn/.test(sp.art.key))).toBe(true);
  });

  it('says what settlers are doing in words, not as soldiers', () => {
    const s = withSettler();
    expect(settlerStatus(s, s.units.u_set)).toMatchObject({ state: 'idle' });
    expect(settlerStatus(s, { ...s.units.u_set, hold: true })).toMatchObject({ state: 'waiting' });
    const site = settleSites(s, settleModeFor(s.units.u_set))[0];
    const st = settlerStatus(s, { ...s.units.u_set, target: site.tile });
    expect(st.state).toBe('travelling');
    expect(st.text).toMatch(/turns?, then they found a village/); // a Stone village people (stonePhase.js settleKey)
    expect(st.text).not.toMatch(/morale|supply|recruit/i);
  });
});

describe('the site card', () => {
  const tiles = getTiles();
  const legal = () => settleSites(withSettler(), { unitId: 'u_set' })[0].tile;

  it('shows what the centre of a city would yield, the name it takes and the outpost stage', () => {
    const m = settleSiteModel(base, legal(), 'bronze');
    expect(m.ok).toBe(true);
    expect(m.centre.food).toBeGreaterThanOrEqual(2);
    expect(m.centre.production).toBeGreaterThanOrEqual(1);
    expect(m.cityName).toBeTruthy();
    expect(m.outpostTurns).toBeGreaterThan(0);
    expect(m.lines.find((l) => l.id === 'name').text).toBe(`The village will be named ${m.cityName}`); // the base world is in the village phase
    expect(m.lines.find((l) => l.id === 'outpost').text).toMatch(/Starts as an outpost/);
    // the name is the one founding gives
    const s = { ...withSettler({ tile: legal() }) };
    const founded = gameReducer(s, { type: ActionTypes.FOUND_CITY, payload: { unitId: 'u_set' } });
    const city = Object.values(founded.regions).find((c) => c.tile === legal());
    expect(city.name).toBe(m.cityName);
    expect(city.outpost).toBeTruthy();
  });

  it('warns about land that cannot grow a city, without forbidding it', () => {
    let poor = null;
    for (let t = 0; t < tiles.count && !poor; t++) {
      if (tiles.land[t] !== 1 || base.world.tileOwner[t] != null) continue;
      const m = settleSiteModel(base, t, 'bronze');
      if (m.ok && m.warnings.some((w) => w.id === 'food')) poor = m;
    }
    expect(poor).toBeTruthy();
    expect(poor.ok).toBe(true);
    expect(poor.warnings.find((w) => w.id === 'food').text).toBe(SITE_WARNING_TEXT.food);
    expect(poor.foodSurplus).toBeLessThanOrEqual(0);
  });

  it('explains the spacing rule in tiles, with the km it can mean', () => {
    const r = spacingRule(tiles);
    expect(r.rings).toBe(citySpacingRings(tiles));
    expect(r.waterRings).toBe(r.rings - 1);
    expect(r.loKm).toBeLessThan(r.hiKm);
    expect(r.text).toMatch(new RegExp(`at least ${r.rings} tiles apart on the same land, ${r.rings - 1} across water`));
    const m = settleSiteModel(base, legal(), 'bronze');
    if (m.nearest?.rings != null) expect(m.lines.find((l) => l.id === 'nearest').text).toMatch(/\d+ tiles? \(\d+ km\)/);
  });

  it('does not name a resource before its age', () => {
    expect(resourceKnown('oil', 'bronze')).toBe(false);
    expect(resourceKnown('oil', 'modern')).toBe(true);
    expect(resourceKnown('coal', 'kingdoms')).toBe(false);
    expect(resourceKnown('coal', 'gunpowder')).toBe(true);
    expect(resourceKnown('wheat', 'bronze')).toBe(true);
    expect(resourceKnown('oil', undefined)).toBe(true);
    // Stone Age: copper shows after Copper Working, horses after Animal Husbandry (U31)
    expect(resourceKnown('copper', 'stone', [])).toBe(false);
    expect(resourceKnown('copper', 'stone', ['military_copper_working'])).toBe(true);
    expect(resourceKnown('horses', 'stone', ['military_copper_working'])).toBe(false);
    expect(resourceKnown('horses', 'stone', ['economy_animal_husbandry'])).toBe(true);
    const oil = tiles.land.findIndex((v, t) => v === 1 && tiles.resourceOf(t) === 'oil');
    if (oil >= 0) {
      expect(settleSiteModel(base, oil, 'bronze').resource).toBeNull();
      expect(settleSiteModel(base, oil, 'bronze').lines.some((l) => l.id === 'resource')).toBe(false);
      expect(settleSiteModel(base, oil, 'modern').resource).toBe('oil');
    }
  });

  it('glyphs grow with the zoom, in steps, up to a cap', () => {
    expect(glyphScale(1)).toBe(1);
    expect(glyphScale(400)).toBe(GLYPH_MAX_SCALE);
    expect((glyphScale(12) * 4) % 1).toBe(0);
  });
});
