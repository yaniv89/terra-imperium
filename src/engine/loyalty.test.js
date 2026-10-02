// src/engine/loyalty.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { addCity } from './testWorld';
import { applyLoyalty, loyaltyTarget, loyaltyOf, cultureOf, LOYALTY_STEP, LOYALTY_GARRISON_PER_UNIT, LOYALTY_CONQUERED, FREE_CITY_JOIN_TURNS, LOYALTY_ON_CONQUEST } from './loyalty';
import { conquerRegion } from './conquest';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 })); return { ...s, units: {} }; })();
const FR = getNationCapital('fr'); const BE = getNationCapital('be');
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });

describe('loyalty', () => {
  it('a city of its own people at home stays loyal; garrison and conquest move the target', () => {
    const paris = S.regions[FR];
    expect(cultureOf(paris)).toEqual({ fr: 1 });
    expect(loyaltyOf(paris)).toBe(100);
    expect(loyaltyTarget(S, paris).total).toBeGreaterThanOrEqual(90);
    const garrisoned = { ...S, units: { a: unit('a', FR, { tile: paris.tile }), b: unit('b', FR, { tile: paris.tile }) } };
    expect(loyaltyTarget(garrisoned, paris).garrison).toBe(2 * LOYALTY_GARRISON_PER_UNIT);
    const taken = { ...paris, owner: 'be', conquest: { turn: S.turnNumber, from: 'fr' }, culture: { fr: 0.9, be: 0.1 } };
    const t = loyaltyTarget({ ...S, regions: { ...S.regions, [FR]: taken } }, taken);
    expect(t.conquered).toBe(LOYALTY_CONQUERED);
    expect(t.total).toBe(0);
  });

  it('a conquered border city drifts to its conqueror\'s culture and settles; a far one flips back', () => {
    // Belgium takes Paris's neighbour... no: France takes Brussels, a city a tile from Paris.
    const r = conquerRegion({ regions: S.regions, nations: S.nations, turnNumber: S.turnNumber }, BE, 'fr', null);
    let regions = { ...r.regions }; const nations = { ...r.nations };
    expect(regions[BE].loyalty).toBe(LOYALTY_ON_CONQUEST);
    const state = { ...S, regions, nations };
    let flipped = null;
    for (let turn = S.turnNumber + 1; turn <= S.turnNumber + 40 && !flipped; turn++) {
      const { flips } = applyLoyalty(state, regions, { a: unit('a', BE, { tile: regions[BE].tile }), b: unit('b', BE, { tile: regions[BE].tile }), c: unit('c', BE, { tile: regions[BE].tile }) }, nations, turn);
      if (flips.length) flipped = flips[0];
    }
    // Garrisoned and under French pressure from Paris next door, Brussels holds and its culture turns.
    expect(flipped).toBeNull();
    expect(cultureOf(regions[BE]).fr).toBeGreaterThan(0.05);
    expect(loyaltyOf(regions[BE])).toBeGreaterThan(0);
  });

  it('a far conquest with nobody around stands free; a foreign city beside a bigger neighbour goes over to it', () => {
    // Canberra, taken by France at the other end of the world: no French pressure, no neighbour.
    const AU = getNationCapital('au');
    const r = conquerRegion({ regions: S.regions, nations: S.nations, turnNumber: S.turnNumber }, AU, 'fr', null);
    let regions = { ...r.regions }; const nations = { ...r.nations };
    const state = { ...S, regions, nations };
    let flip = null;
    for (let turn = S.turnNumber + 1; turn <= S.turnNumber + 40 && !flip; turn++) { const { flips } = applyLoyalty(state, regions, {}, nations, turn); if (flips.length) flip = flips[0]; }
    expect(flip).toMatchObject({ cityId: AU, from: 'fr', to: null });
    expect(regions[AU].owner).toBeNull();
    expect(regions[AU].freeCity).toBeTruthy();
    assertGameState({ ...state, regions, nations });
    // A Belgian city founded on Paris's doorstep, with no garrison, turns French.
    const { state: s2, cityId } = addCity(S, 'be', { near: FR });
    const r2 = { ...s2.regions, [FR]: { ...s2.regions[FR], size: 20 } }; const n2 = { ...s2.nations };
    let flip2 = null;
    for (let turn = S.turnNumber + 1; turn <= S.turnNumber + 80 && !flip2; turn++) { const { flips } = applyLoyalty({ ...s2, regions: r2, nations: n2 }, r2, {}, n2, turn); if (flips.length) flip2 = flips[0]; }
    expect(flip2).toMatchObject({ cityId, from: 'be', to: 'fr' });
    expect(r2[cityId].owner).toBe('fr');
    expect(r2[cityId].loyalty).toBe(50);
  });

  it('a free city joins its most pressing neighbour after a while, and capitals never flip', () => {
    const { state: s2, cityId } = addCity(S, 'fr', { near: FR });
    const free = { ...s2.regions[cityId], owner: null, control: 0, loyalty: 50, freeCity: { since: s2.turnNumber, formerOwner: 'fr' } };
    const regions = { ...s2.regions, [cityId]: free }; const nations = { ...s2.nations };
    const early = applyLoyalty(s2, regions, {}, nations, s2.turnNumber + 1);
    expect(early.flips).toEqual([]);
    const late = applyLoyalty(s2, regions, {}, nations, s2.turnNumber + FREE_CITY_JOIN_TURNS);
    expect(late.flips[0]).toMatchObject({ cityId, from: null });
    expect(regions[cityId].owner).toBeTruthy();
    const disloyal = { ...S.regions[FR], loyalty: 0, culture: { be: 1 } };
    const r2 = { ...S.regions, [FR]: disloyal }; const n2 = { ...S.nations };
    const res = applyLoyalty({ ...S, regions: r2 }, r2, {}, n2, S.turnNumber + 1);
    expect(res.flips).toEqual([]);
    expect(r2[FR].owner).toBe('fr');
  });

  it('runs through resolveTurn and the player hears when a city wavers', () => {
    const r = conquerRegion({ regions: S.regions, nations: S.nations, turnNumber: S.turnNumber }, BE, 'fr', null);
    let s = { ...S, regions: r.regions, nations: r.nations, wars: [] };
    for (let i = 0; i < 6; i++) { if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE }); s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; }
    expect(s.regions[BE].loyalty).toBeLessThan(LOYALTY_ON_CONQUEST);
    expect(s.regions[BE].loyalty).toBeGreaterThanOrEqual(LOYALTY_ON_CONQUEST - 6 * LOYALTY_STEP);
    expect(s.logs.some((l) => /losing its loyalty|gone over|free city/.test(l.message))).toBe(true);
    assertGameState(s);
  }, 60000);
});
