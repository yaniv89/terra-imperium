// src/engine/supplies.test.js
import { describe, it, expect } from 'vitest';
import { computeSupplyFlow, industryMetalFor, isCampaigning, SUPPLY_FORAGE_PER_REGION, SUPPLIES_PER_INDUSTRY_TIER, METAL_PER_INDUSTRY_TIER, HUNGER_MORALE } from './supplies';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { getNeighborIds } from '../data/regions';

const regions = {
  a: { id: 'a', owner: 'me', control: 100, buildings: { categories: { industry: 1 } } }, // Manufactory: 2 tiers
  b: { id: 'b', owner: 'me', control: 50 },
  c: { id: 'c', owner: 'them', control: 100 }
};
const units = { home: { id: 'home', ownerId: 'me', regionId: 'a', domain: 'land' }, away: { id: 'away', ownerId: 'me', regionId: 'c', domain: 'land' }, ship: { id: 'ship', ownerId: 'me', regionId: 'c', domain: 'naval' } };

describe('army supplies', () => {
  it('uses the age\'s metal: copper, then iron, then oil', () => {
    expect(industryMetalFor('bronze')).toBe('copper');
    expect(industryMetalFor('gunpowder')).toBe('iron');
    expect(industryMetalFor('modern')).toBe('oil');
  });
  it('forages from held provinces, manufactures from metal, and campaigning land units eat', () => {
    const flow = computeSupplyFlow({ regions, units, nationId: 'me', ageId: 'classical', resources: { iron: 100, supplies: 10 } });
    expect(flow.forage).toBeCloseTo(SUPPLY_FORAGE_PER_REGION * 1.5);
    expect(flow.metalUsed).toBe(2 * METAL_PER_INDUSTRY_TIER);
    expect(flow.manufactured).toBe(2 * SUPPLIES_PER_INDUSTRY_TIER);
    expect(flow.campaigning).toBe(1); // the ship and the unit at home don't count
    expect(flow.supplies).toBeCloseTo(10 + flow.produced - 1);
    expect(isCampaigning(units.home, regions)).toBe(false);
  });
  it('without metal the factories stand idle; an empty stock leaves the army hungry', () => {
    const flow = computeSupplyFlow({ regions, units: { ...units, a2: { ...units.away, id: 'a2' }, a3: { ...units.away, id: 'a3' } }, nationId: 'me', ageId: 'classical', resources: { iron: 0, supplies: 0 } });
    expect(flow.manufactured).toBe(0);
    expect(flow.hungry).toBe(true);
    expect(flow.supplies).toBe(0);
  });
  it('a hungry army abroad loses morale and does not recover in resolveTurn', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 4 });
    const foreign = Object.keys(s.regions).find((id) => s.regions[id].owner !== 'fr' && getNeighborIds(id).some((n) => s.regions[n]?.owner === 'fr'));
    const army = {};
    for (let i = 0; i < 40; i++) army[`u${i}`] = { id: `u${i}`, regionId: foreign, ownerId: 'fr', domain: 'land', classId: 'infantry', strength: 800, maxStrength: 1000, morale: 60, movesLeft: 1, promotions: [] };
    const next = resolveTurn({ ...s, units: army, resources: { ...s.resources, supplies: 0 } });
    expect(next.units.u0.morale).toBe(60 - HUNGER_MORALE);
    expect(next.logs.some((l) => /Out of supplies/.test(l.message))).toBe(true);
    const fed = resolveTurn({ ...s, units: army, resources: { ...s.resources, supplies: 1000 } });
    expect(fed.units.u0.morale).toBeGreaterThanOrEqual(60);
  });
});
