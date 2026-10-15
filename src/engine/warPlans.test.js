import { describe, it, expect } from 'vitest';
import { addCity } from './testWorld';
import { getNeighborIds } from '../data/regions';
import {
  strikeSize, payableUnits, armyCap, goSize, readyToStrike, launched, updateWarPlan, garrisonUnits, hostileReach, interiorCitySafe, SAFE_TURNS,
  STRIKE_MIN, STRIKE_MAX, WAR_UNITS_PER_CITY, GATHER_MAX_TURNS, GATHER_MIN_UNITS, WAR_CHEST_TURNS, UPKEEP_MARGIN
} from './warPlans';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { kmPerRing } from '../data/geo/gridScale';
import { MOVE_KM } from './armies';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 7 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const unit = (id, ownerId, regionId, tile, extra = {}) => ({ id, ownerId, regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [], xp: 0, ...extra });

const world = () => {
  const s0 = neighbourWorld({ seed: 7 });
  const berlin = s0.nations[DE_ID].capitalRegionId;
  const added = addCity(s0, DE_ID, { near: berlin, loose: true });
  const s = added.state;
  const paris = getNeighborIds(berlin).find((id) => s.regions[id]?.owner === FR_ID);
  s.nations[DE_ID] = { ...s.nations[DE_ID], economy: { gold: 400, hr: 1000, mil: 100, adm: 100 }, lastNetIncome: 10 };
  return { s, berlin, interior: added.cityId, paris };
};

describe('war plans (lane W5)', () => {
  it('sizes the strike by the garrison, the walls and the city, within the age bounds', () => {
    const { s, paris } = world();
    const city = { ...s.regions[paris], size: 2, buildings: { categories: {} } };
    expect(strikeSize({ ...s, units: {} }, city, 'bronze')).toBe(STRIKE_MIN);
    const garrisoned = { ...s, units: { g1: unit('g1', FR_ID, paris, city.tile), g2: unit('g2', FR_ID, paris, city.tile), g3: unit('g3', FR_ID, paris, city.tile) } };
    expect(garrisonUnits(garrisoned, city)).toBe(3);
    // 2 x 3 garrison + 0.5 x size 2 = 7
    expect(strikeSize(garrisoned, city, 'bronze')).toBe(7);
    const walled = { ...city, buildings: { categories: { defense: 1 } } }; // two wall levels: +3
    expect(strikeSize(garrisoned, walled, 'bronze')).toBe(STRIKE_MAX.bronze);
    expect(strikeSize(garrisoned, walled, 'modern')).toBe(10);
  });

  it('never plans an army the income and treasury cannot pay', () => {
    const per = UNIT_UPKEEP_GOLD_PER_TURN;
    expect(payableUnits({ lastNetIncome: 3 * per * UPKEEP_MARGIN, economy: { gold: 0 } }, 5)).toBe(8);
    expect(payableUnits({ lastNetIncome: -20, economy: { gold: 2 * per * WAR_CHEST_TURNS } }, 5)).toBe(7);
    // Want: 4 cities at home + a strike of 8 = 12; the budget carries 6; never under the peacetime 4.
    expect(armyCap({ lastNetIncome: per * UPKEEP_MARGIN, economy: { gold: 0 } }, 4, 8, 5)).toBe(6);
    expect(armyCap({ lastNetIncome: 0, economy: { gold: 0 } }, 4, 8, 1)).toBe(4);
    expect(armyCap({ lastNetIncome: 1000, economy: { gold: 0 } }, 2, 8, 2)).toBe(2 * WAR_UNITS_PER_CITY);
  });

  it('marches with most of the strike, smaller later waves, and after a while with what it has', () => {
    const plan = { strike: 8, since: 10, waves: 0 };
    expect(goSize(plan)).toBe(5); // 60% of 8, rounded up
    expect(readyToStrike(plan, 4, 11)).toBe(false);
    expect(readyToStrike(plan, 5, 11)).toBe(true);
    expect(readyToStrike(plan, GATHER_MIN_UNITS, 10 + GATHER_MAX_TURNS)).toBe(true);
    expect(readyToStrike(plan, 1, 100)).toBe(false);
    const next = launched(plan, 20);
    expect(next).toEqual({ strike: 8, since: 20, waves: 1 });
    expect(goSize(next)).toBe(4);
  });

  it('targets the enemy city next door and gathers at its own city nearest it, and keeps the plan', () => {
    const { s, berlin, paris } = world();
    const wars = [{ id: 'w', aggressor: DE_ID, enemy: FR_ID, active: true }];
    const st = { ...s, wars, units: {} };
    const plan = updateWarPlan(st, DE_ID, wars, 'bronze');
    expect(plan.enemy).toBe(FR_ID);
    expect(st.regions[plan.cityId].owner).toBe(FR_ID);
    expect(plan.staging).toBe(berlin);
    expect(plan.strike).toBeGreaterThanOrEqual(STRIKE_MIN);
    expect(plan.cap).toBeGreaterThanOrEqual(2);
    expect(plan.since).toBe(st.turnNumber);
    // The same state gives the same object back (no churn in the save).
    const kept = updateWarPlan({ ...st, nations: { ...st.nations, [DE_ID]: { ...st.nations[DE_ID], warPlan: plan } } }, DE_ID, wars, 'bronze');
    expect(kept).toBe(plan);
    // The war's goal city wins over the nearest one.
    const goalWars = [{ ...wars[0], goal: { type: 'capture_region', regionId: paris } }];
    expect(updateWarPlan({ ...st, wars: goalWars }, DE_ID, goalWars, 'bronze').cityId).toBe(paris);
  });

  it('has no plan at peace without a claim in the making, and arms against a claim', () => {
    const { s, paris } = world();
    expect(updateWarPlan({ ...s, wars: [] }, DE_ID, [], 'bronze')).toBe(null);
    const arming = { ...s, wars: [], nations: { ...s.nations, [DE_ID]: { ...s.nations[DE_ID], claimsInProgress: [{ cityId: paris, done: 99 }] } } };
    const plan = updateWarPlan(arming, DE_ID, [], 'bronze');
    expect(plan.cityId).toBe(paris);
    expect(plan.enemy).toBe(FR_ID);
  });
  it('lets an interior city send all its troops only when nothing hostile is within 3 turns (lead ruling)', () => {
    const { s, interior } = world();
    const tiles = getTiles();
    const city = s.regions[interior];
    const wars = [{ id: 'w', aggressor: DE_ID, enemy: FR_ID, active: true }];
    const quiet = { ...s, wars, units: {} };
    expect(interiorCitySafe(city, hostileReach(quiet, DE_ID), tiles)).toBe(true);
    // An enemy regiment two rings off can reach it within SAFE_TURNS turns.
    const near = [...ringsAround(tiles, city.tile, 2)].find(([t, r]) => r === 2 && tiles.land[t] === 1)[0];
    const threatened = { ...quiet, units: { e: unit('e', FR_ID, s.nations[FR_ID].capitalRegionId, near) } };
    expect(interiorCitySafe(city, hostileReach(threatened, DE_ID), tiles)).toBe(false);
    // The same regiment of a nation at peace is no threat.
    expect(interiorCitySafe(city, hostileReach({ ...threatened, wars: [] }, DE_ID), tiles)).toBe(true);
    // An enemy far beyond SAFE_TURNS marches is no threat either.
    const rings = Math.ceil((SAFE_TURNS * MOVE_KM.infantry) / kmPerRing(tiles)) + 3;
    const far = [...ringsAround(tiles, city.tile, rings)].find(([t, r]) => r === rings && tiles.land[t] === 1)[0];
    expect(interiorCitySafe(city, hostileReach({ ...quiet, units: { e: unit('e', FR_ID, s.nations[FR_ID].capitalRegionId, far) } }, DE_ID), tiles)).toBe(true);
  });
});
