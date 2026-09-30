// src/engine/pressures.test.js
// Economic and home-front pressure: supply lines cut by enemy occupation, desertion on bankruptcy,
// mechanised units grounded with no oil, industry and war exhaustion feeding unrest.
import { describe, it, expect } from 'vitest';
import { resolveTurn, DESERTION_SHARE } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { HISTORICAL_EVENTS } from '../data/events';
import { regionsWithinRange, getNeighborIds } from '../data/regions';
import { BUILDING_CATEGORIES } from '../data/buildings';

const quiet = (s) => ({
  ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {}),
  proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }
});
const fresh = () => quiet(createInitialState({ playerNationId: 'fr', rngSeed: 77 }));
const unit = (id, regionId, extra = {}) => ({ id, regionId, homeRegionId: regionId, ownerId: 'fr', domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });

describe('supply lines', () => {
  it('supply reaches an enemy-held province but does not flow through it', () => {
    // a chain a - b - c: blocking b stops c being reached from a
    let a; let b; let c;
    for (const id of Object.keys(fresh().regions)) {
      const nb = getNeighborIds(id).find((x) => getNeighborIds(x).some((y) => y !== id && !getNeighborIds(id).includes(y)));
      if (!nb) continue;
      a = id; b = nb; c = getNeighborIds(nb).find((y) => y !== id && !getNeighborIds(id).includes(y));
      break;
    }
    const open = regionsWithinRange([a], 2);
    const cut = regionsWithinRange([a], 2, (id) => id === b);
    expect(open.has(c)).toBe(true);
    expect(cut.has(b)).toBe(true);
    expect(cut.has(c)).toBe(false);
  });
});

describe('bankruptcy desertion', () => {
  it('an army that cannot be paid loses men and morale', () => {
    const s = fresh();
    const home = Object.keys(s.regions).find((id) => s.regions[id].owner === 'fr');
    const units = { u1: unit('u1', home) };
    const broke = { ...s, units, resources: { ...s.resources, gold: -100000 }, loans: [], techTree: {} };
    const next = resolveTurn(broke);
    expect(next.logs.some((l) => /Bankruptcy/.test(l.message))).toBe(true);
    expect(next.units.u1.strength).toBe(Math.floor(1000 * (1 - DESERTION_SHARE)));
    expect(next.units.u1.morale).toBe(80);
    expect(next.logs.some((l) => /desert/.test(l.message))).toBe(true);
    // paid troops don't desert
    const paid = resolveTurn({ ...broke, resources: { ...s.resources, gold: 100000 } });
    expect(paid.units.u1.strength).toBe(1000);
  });
});

describe('no oil', () => {
  it("grounds the player's modern tanks and aircraft, not their infantry", () => {
    const s = fresh();
    const home = Object.keys(s.regions).find((id) => s.regions[id].owner === 'fr');
    const modern = { ...s, age: 'modern', techAgeId: 'modern', year: 1950, resources: { ...s.resources, oil: 0 },
      units: { t: unit('t', home, { classId: 'cavalry' }), i: unit('i', home) } };
    const next = resolveTurn(modern);
    expect(next.units.t.movesLeft).toBe(0);
    expect(next.units.i.movesLeft).toBeGreaterThan(0);
    const fuelled = resolveTurn({ ...modern, resources: { ...modern.resources, oil: 50 } });
    expect(fuelled.units.t.movesLeft).toBeGreaterThan(0);
  });
});

describe('home-front unrest', () => {
  it('industry tiers past the workshop carry a stability cost', () => {
    const tiers = BUILDING_CATEGORIES.industry.tiers;
    expect(tiers.slice(1).every((t) => (t.effects['local.stabilityBonus'] || 0) < 0)).toBe(true);
  });
  it("a war-weary nation's provinces grow restless", () => {
    const s = fresh();
    const calm = resolveTurn(s);
    const weary = resolveTurn({ ...s, nations: { ...s.nations, fr: { ...s.nations.fr, warExhaustion: 100 } } });
    const own = Object.keys(s.regions).filter((id) => s.regions[id].owner === 'fr');
    const sum = (st) => own.reduce((a, id) => a + (st.regions[id].unrest || 0), 0);
    expect(sum(weary)).toBeGreaterThan(sum(calm));
  });
  it('national stability, legitimacy and techs now reach province unrest', () => {
    const s = fresh();
    const own = Object.keys(s.regions).filter((id) => s.regions[id].owner === 'fr');
    const sum = (st) => own.reduce((a, id) => a + (st.regions[id].unrest || 0), 0);
    const seeded = { ...s, regions: { ...s.regions } };
    own.forEach((id) => { seeded.regions[id] = { ...seeded.regions[id], unrest: 30, control: 100 }; });
    const stable = resolveTurn({ ...seeded, nations: { ...s.nations, fr: { ...s.nations.fr, stability: 2 } } });
    const shaky = resolveTurn({ ...seeded, nations: { ...s.nations, fr: { ...s.nations.fr, stability: -2 } } });
    expect(sum(shaky)).toBeGreaterThan(sum(stable));
    const industrial = resolveTurn({ ...seeded, techTree: { ...s.techTree, economy_industrial_capital: { researched: true } } });
    expect(sum(industrial)).toBeGreaterThan(sum(resolveTurn(seeded)));
  });
});
