// What the player is told before founding, and the Wait and Disband orders of settlers
// (playtest audit I054, I091, I092, I093): src/engine/settlers.js.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { getTiles } from '../data/geo/tiles';
import { CENTRE_MIN_YIELDS, FOOD_PER_CITIZEN, MAX_SIZE } from './world/cities';
import {
  bestSites, makeSettler, outpostTurns, outpostTurnsLeft, siteOutlook, settlingOutlook, setSettlerHold, disbandSettlers, settlersHomeCity,
  OUTPOST_DONE, OUTPOST_PROGRESS, OUTPOST_TERRAIN_FACTOR, MAX_SETTLE_RINGS
} from './settlers';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { speedCostMult } from '../data/ages';

const game = () => {
  const s = createInitialState({ playerNationId: 'eg', rngSeed: 7 });
  const cap = s.regions[getNationCapital('eg')];
  const site = bestSites(s, 'eg', cap.tile, 'bronze', { rings: 12, limit: 1 })[0];
  const settler = { ...makeSettler('u_set', cap, 'eg'), tile: site.tile };
  return { s: { ...s, units: { ...s.units, u_set: settler } }, cap, site };
};

describe('what a site would be', () => {
  it('the outpost stage lasts OUTPOST_DONE over the progress a turn, slower on hard land and at slower speeds', () => {
    const { s, site } = game();
    const turns = outpostTurns(s, site.tile, 'bronze');
    expect(turns).toBeGreaterThanOrEqual(Math.ceil(OUTPOST_DONE / (OUTPOST_PROGRESS / speedCostMult(s.gameSpeed, 'bronze'))));
    const slowest = Math.min(...Object.values(OUTPOST_TERRAIN_FACTOR));
    expect(turns).toBeLessThanOrEqual(Math.ceil(OUTPOST_DONE / ((OUTPOST_PROGRESS * slowest) / speedCostMult(s.gameSpeed, 'bronze'))));
    expect(outpostTurns({ ...s, gameSpeed: 'marathon' }, site.tile, 'bronze')).toBeGreaterThanOrEqual(turns);
  }, 60000);

  it('an outpost counts down the same turns the site card promised (the city panel, I054)', () => {
    const { s, site } = game();
    const turns = outpostTurns(s, site.tile, 'bronze');
    const city = { tile: site.tile, outpost: { progress: 0 } };
    expect(outpostTurnsLeft(s, city, 'bronze')).toBe(turns);
    expect(outpostTurnsLeft(s, { ...city, outpost: { progress: OUTPOST_DONE - 0.1 } }, 'bronze')).toBe(1);
    expect(outpostTurnsLeft(s, { tile: site.tile, outpost: null }, 'bronze')).toBeNull();
  }, 60000);

  it('the centre never yields less than the city rules give it, and the surplus is the centre plus the best tile minus one citizen', () => {
    const { s, site } = game();
    const o = siteOutlook(s, site.tile, 'eg');
    expect(o.centre.food).toBeGreaterThanOrEqual(CENTRE_MIN_YIELDS.food);
    expect(o.centre.production).toBeGreaterThanOrEqual(CENTRE_MIN_YIELDS.production);
    expect(o.foodSurplus).toBe(o.centre.food + o.best.food - FOOD_PER_CITIZEN);
    expect(o.production).toBe(o.centre.production + o.best.production);
    expect(siteOutlook(s, null)).toBeNull();
  }, 60000);

  it('warns about a site that cannot grow or build, and not about a good one', () => {
    const { s } = game();
    const tiles = getTiles();
    const owner = s.world.tileOwner;
    let poor = null; let good = null;
    for (let t = 0; t < tiles.count && !(poor && good); t++) {
      if (tiles.land[t] !== 1 || owner[t] != null) continue;
      const o = siteOutlook(s, t, 'eg');
      if (!poor && o.warnings.includes('food')) poor = o;
      if (!good && o.warnings.length === 0) good = o;
    }
    expect(poor).toBeTruthy();
    expect(poor.foodSurplus).toBeLessThanOrEqual(0);
    expect(good).toBeTruthy();
    expect(good.foodSurplus).toBeGreaterThan(0);
  }, 60000);

  it('says whether settlers from a city would find a site at all', () => {
    const { s, cap } = game();
    const out = settlingOutlook(s, 'eg', cap.tile, 'bronze');
    expect(out.ok).toBe(true);
    expect(out.best.tile).toBe(bestSites(s, 'eg', cap.tile, 'bronze', { rings: MAX_SETTLE_RINGS, limit: 1 })[0].tile);
    // nothing explored but the capital's own land: no site is known, so none is promised
    const blind = { ...s, fog: { ...(s.fog || {}), on: true }, scenario: { ...(s.scenario || {}), fog: true }, explored: undefined };
    expect(settlingOutlook(s, 'eg', null, 'bronze')).toEqual({ ok: false, best: null });
    expect(typeof settlingOutlook(blind, 'eg', cap.tile, 'bronze').ok).toBe('boolean');
  }, 60000);
});

describe('settlers wait or go home', () => {
  it('settlers told to wait leave the idle list, and a destination ends the wait', () => {
    const { s, site } = game();
    const idle = (x) => nextPrompts(x).filter((p) => p.id === 'settler:u_set').length;
    expect(idle(s)).toBe(1);
    const held = gameReducer(s, { type: ActionTypes.SET_SETTLER_HOLD, payload: { unitId: 'u_set', hold: true } });
    expect(held.units.u_set.hold).toBe(true);
    expect(idle(held)).toBe(0);
    expect(setSettlerHold(held, 'u_set', true)).toBeNull(); // nothing to change
    const released = gameReducer(held, { type: ActionTypes.SET_SETTLER_HOLD, payload: { unitId: 'u_set', hold: false } });
    expect(idle(released)).toBe(1);
    // sent somewhere while waiting: the wait is over
    const other = bestSites(s, 'eg', site.tile, 'bronze', { rings: 12, limit: 5 }).find((x) => x.tile !== site.tile);
    const sent = gameReducer(held, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: 'u_set', tile: other.tile } });
    expect(sent.units.u_set.target).toBe(other.tile);
    expect(sent.units.u_set.hold).toBe(false);
    // not an army's order, and not for another nation's settlers
    expect(setSettlerHold({ ...s, playerNationId: 'fr' }, 'u_set', true)).toBeNull();
  }, 60000);

  it('disbanded settlers are gone and their citizen joins the nearest own city', () => {
    const { s, cap } = game();
    expect(settlersHomeCity(s, s.units.u_set).id).toBe(cap.id);
    const after = gameReducer(s, { type: ActionTypes.DISBAND_SETTLERS, payload: { unitId: 'u_set' } });
    expect(after.units.u_set).toBeUndefined();
    expect(after.regions[cap.id].size).toBe(cap.size + 1);
    expect(after.resources.hr).toBe(s.resources.hr); // no soldiers' refund
    expect(after.logs[after.logs.length - 1].message).toMatch(/go home/);
    assertGameState(after);
  }, 60000);

  it('a full city takes nobody, and somebody else\'s settlers are not yours to disband', () => {
    const { s, cap } = game();
    const full = { ...s, regions: { ...s.regions, [cap.id]: { ...cap, size: MAX_SIZE } } };
    const out = disbandSettlers(full, 'u_set');
    expect(out.city).toBeNull();
    expect(out.units.u_set).toBeUndefined();
    expect(out.regions).toBe(full.regions);
    expect(disbandSettlers({ ...s, playerNationId: 'fr' }, 'u_set')).toBeNull();
    const refused = gameReducer({ ...s, playerNationId: 'fr' }, { type: ActionTypes.DISBAND_SETTLERS, payload: { unitId: 'u_set' } });
    expect(refused.units.u_set).toBeDefined();
  }, 60000);
});
