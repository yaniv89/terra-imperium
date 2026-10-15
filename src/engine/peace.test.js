import { describe, it, expect } from 'vitest';
import { getTermCost, getPeaceCost, getMaxPeaceCost, getPeaceAcceptance, applyPeace, buildAITerms } from './peace';
import { getNationCapital } from '../data/regions';
import { addCity } from './testWorld';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 11 });
const US_ID = PEOPLES_WORLD.playerNationId;
const CA_ID = rivalOf(PEOPLES_WORLD, 0);
const MX_ID = rivalOf(PEOPLES_WORLD, 1);

const cap = getNationCapital;
const usState = () => neighbourWorld();

// A minimal war record between the US (aggressor) and Canada (enemy), with Canada's capital
// occupied by the US — the shared starting point for most of these tests.
const warWithOccupiedCapital = (state, overrides = {}) => ({
  id: 'war_1', aggressor: US_ID, enemy: CA_ID, active: true, goalAchieved: false,
  startYear: state.year, startTurn: state.turnNumber, cb: 'none',
  battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0,
  goal: { type: 'capture_region', regionId: cap(CA_ID) },
  ...overrides
});

describe('getTermCost', () => {
  it('cede: scales with the ceded region\'s share of the recipient\'s total development', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const cost = getTermCost(state, war, US_ID, { type: 'cede', regionId: cap(CA_ID) });
    expect(cost).toBeGreaterThanOrEqual(3);
    expect(cost).toBeLessThanOrEqual(100);
  });

  it('cede: is infinite (unpayable) for a region the recipient does not own', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, US_ID, { type: 'cede', regionId: cap(US_ID) })).toBe(Infinity);
  });

  it('cede: is discounted when the war has a claim casus belli', () => {
    const state = usState();
    const claimed = getTermCost(state, warWithOccupiedCapital(state, { cb: 'claim' }), US_ID, { type: 'cede', regionId: cap(CA_ID) });
    const unclaimed = getTermCost(state, warWithOccupiedCapital(state, { cb: 'none' }), US_ID, { type: 'cede', regionId: cap(CA_ID) });
    expect(claimed).toBeLessThanOrEqual(unclaimed);
  });

  it('gold: divides the amount by a flat divisor, capped', () => {
    const state = usState();
    state.nations[CA_ID].economy.gold = 50000;
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, US_ID, { type: 'gold', amount: 500 })).toBe(1);
    expect(getTermCost(state, war, US_ID, { type: 'gold', amount: 50000 })).toBe(30); // capped
  });

  it('reparations and humiliate are flat costs', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, US_ID, { type: 'reparations' })).toBe(15);
    expect(getTermCost(state, war, US_ID, { type: 'humiliate' })).toBe(15);
  });

  it('vassalize scales with the offerer\'s dev share', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, US_ID, { type: 'vassalize' })).toBeGreaterThanOrEqual(60);
  });
});

describe('getPeaceCost', () => {
  it('sums every term\'s cost', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const terms = [{ type: 'reparations' }, { type: 'humiliate' }];
    expect(getPeaceCost(state, war, US_ID, terms)).toBe(30);
  });

  it('is 0 for a white peace (no terms)', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getPeaceCost(state, war, US_ID, [])).toBe(0);
  });
});

describe('getMaxPeaceCost', () => {
  it('scales with how much the offerer is winning by, capped at 100', () => {
    const war = { aggressor: US_ID, enemy: CA_ID, score: 40 };
    expect(getMaxPeaceCost(war, US_ID)).toBe(50);
    expect(getMaxPeaceCost(war, CA_ID)).toBe(10); // ca is losing (score -40 from its own view): only the flat floor
  });

  it('never exceeds 100', () => {
    const war = { aggressor: US_ID, enemy: CA_ID, score: 100 };
    expect(getMaxPeaceCost(war, US_ID)).toBe(100);
  });
});

describe('getPeaceAcceptance', () => {
  it('accepts a free white peace when the recipient is losing badly', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const result = getPeaceAcceptance(state, war, US_ID, []);
    expect(result.cost).toBe(0);
    expect(result.accepted).toBe(true);
  });

  it('rejects demands the recipient has no reason to accept when the war is even', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 0 });
    const result = getPeaceAcceptance(state, war, US_ID, [{ type: 'vassalize' }]);
    expect(result.accepted).toBe(false);
  });

  it('is more willing to accept the worse the recipient\'s war exhaustion', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 0 });
    const calm = getPeaceAcceptance(state, war, US_ID, [{ type: 'reparations' }]);
    const exhaustedState = { ...state, nations: { ...state.nations, [CA_ID]: { ...state.nations[CA_ID], warExhaustion: 100 } } };
    const exhausted = getPeaceAcceptance(exhaustedState, war, US_ID, [{ type: 'reparations' }]);
    expect(exhausted.total).toBeGreaterThan(calm.total);
  });
});

describe('getPeaceAcceptance: the bargaining model (warOdds.js)', () => {
  it('a recipient facing a far stronger army concedes more than one facing an equal army', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 0 });
    const units = (owner, n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${owner}${i}`, { id: `${owner}${i}`, ownerId: owner, regionId: cap(owner), tile: state.regions[cap(owner)].tile, domain: 'land', classId: 'infantry', strength: 1000 }]));
    const even = getPeaceAcceptance({ ...state, units: { ...units(US_ID, 3), ...units(CA_ID, 3) } }, war, US_ID, []);
    const crushed = getPeaceAcceptance({ ...state, units: { ...units(US_ID, 9), ...units(CA_ID, 3) } }, war, US_ID, []);
    expect(crushed.odds).toBeGreaterThan(even.odds);
    expect(crushed.total).toBeGreaterThan(even.total);
    expect(crushed.breakdown.find((l) => l.label === 'Odds if the war goes on').value).toBeGreaterThan(0);
  });
});

describe('applyPeace', () => {
  it('cede: transfers ownership, sets formerOwner, and accrues Aggressive Expansion', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const result = applyPeace(occupiedState, war, US_ID, [{ type: 'cede', regionId: cap(CA_ID) }]);
    expect(result.regions[cap(CA_ID)].owner).toBe(US_ID);
    expect(result.regions[cap(CA_ID)].occupiedBy).toBeUndefined();
    expect(result.regions[cap(CA_ID)].formerOwner).toBe(CA_ID);
    expect(result.nations[CA_ID].ae?.[US_ID]).toBeGreaterThan(0);
  });

  it('liberates any occupied-but-not-ceded regions between the two belligerents', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const result = applyPeace(occupiedState, war, US_ID, []); // white peace: nothing ceded
    expect(result.regions[cap(CA_ID)].owner).toBe(CA_ID);
    expect(result.regions[cap(CA_ID)].occupiedBy).toBeUndefined();
  });

  it('does not disturb occupation from an unrelated third party', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    // Mexico happens to be occupying the US's capital in some OTHER war — unrelated to this peace.
    const withThirdParty = { ...state, regions: { ...state.regions, [cap(US_ID)]: { ...state.regions[cap(US_ID)], occupiedBy: MX_ID } } };
    const result = applyPeace(withThirdParty, war, US_ID, []);
    expect(result.regions[cap(US_ID)].occupiedBy).toBe(MX_ID);
  });

  it('gold: only moves state.resources when the player is a party to the deal', () => {
    const state = { ...usState(), resources: { ...usState().resources, gold: 1000 } };
    state.nations[CA_ID].economy.gold = 300;
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, US_ID, [{ type: 'gold', amount: 300 }]);
    expect(result.resources.gold).toBe(1300);
  });

  it('gold: leaves the player treasury untouched between two AI nations', () => {
    const state = usState();
    const aiWar = { ...warWithOccupiedCapital(state), aggressor: MX_ID, enemy: CA_ID };
    const result = applyPeace(state, aiWar, MX_ID, [{ type: 'gold', amount: 300 }]);
    expect(result.resources).toBe(state.resources);
  });

  it('reparations: applies opposite-signed timed goldMult modifiers to winner and loser', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, US_ID, [{ type: 'reparations' }]);
    const winnerMod = result.nations[US_ID].modifiers.find(m => m.label === 'War Reparations');
    const loserMod = result.nations[CA_ID].modifiers.find(m => m.label === 'War Reparations');
    expect(winnerMod.mods['national.goldMult']).toBeGreaterThan(0);
    expect(loserMod.mods['national.goldMult']).toBeLessThan(0);
  });

  it('humiliate: raises the winner\'s prestige and lowers the loser\'s prestige and stability', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, US_ID, [{ type: 'humiliate' }]);
    expect(result.nations[US_ID].prestige).toBeGreaterThan(state.nations[US_ID].prestige);
    expect(result.nations[CA_ID].prestige).toBeLessThan(state.nations[CA_ID].prestige);
    expect(result.nations[CA_ID].stability).toBeLessThan(state.nations[CA_ID].stability);
  });

  it('vassalize: makes the recipient a vassal of the offerer', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, US_ID, [{ type: 'vassalize' }]);
    expect(result.nations[CA_ID].vassalOf).toBe(US_ID);
    expect(result.nations[US_ID].vassals).toContain(CA_ID);
  });

  it('a losing aggressor can offer terms too — otherSide resolves from either direction', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { aggressor: CA_ID, enemy: US_ID });
    const occupiedState = { ...state, regions: { ...state.regions, [cap(US_ID)]: { ...state.regions[cap(US_ID)], occupiedBy: CA_ID } } };
    const result = applyPeace(occupiedState, war, CA_ID, [{ type: 'cede', regionId: cap(US_ID) }]);
    expect(result.regions[cap(US_ID)].owner).toBe(CA_ID);
  });

  it('capital lost in peace (plan §M15): the recipient auto-relocates its capital and loses stability', () => {
    const state = addCity(usState(), CA_ID).state;
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const result = applyPeace(occupiedState, war, US_ID, [{ type: 'cede', regionId: cap(CA_ID) }]);
    expect(result.nations[CA_ID].capitalRegionId).not.toBe(cap(CA_ID));
    expect(result.regions[result.nations[CA_ID].capitalRegionId].owner).toBe(CA_ID);
    expect(result.nations[CA_ID].stability).toBe((occupiedState.nations[CA_ID].stability || 0) - 2);
  });

  it('does not relocate the capital when a peace deal leaves it in the recipient\'s hands', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, US_ID, []); // white peace
    expect(result.nations[CA_ID].capitalRegionId).toBe(state.nations[CA_ID].capitalRegionId);
  });
});

describe('buildAITerms', () => {
  it('demands the occupied goal region when it is affordable', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const occupiedState = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const terms = buildAITerms(occupiedState, war, US_ID);
    expect(terms).toContainEqual({ type: 'cede', regionId: cap(CA_ID) });
  });

  it('falls back to reparations when nothing occupied is affordable to cede', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { goal: { type: 'destroy_military', threshold: 1 }, battleScore: 40, score: 40 });
    const terms = buildAITerms(state, war, US_ID);
    expect(terms).toEqual([{ type: 'reparations' }]);
  });

  it('offers a white peace when even reparations exceed the justified budget', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { goal: { type: 'destroy_military', threshold: 1 }, battleScore: 0, score: 0 });
    const terms = buildAITerms(state, war, US_ID);
    expect(terms).toEqual([]);
  });

  it('never demands more than the region-cost cap of dev share', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const occupiedState = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const terms = buildAITerms(occupiedState, war, US_ID);
    const cost = getPeaceCost(occupiedState, war, US_ID, terms);
    expect(cost).toBeLessThanOrEqual(getMaxPeaceCost(war, US_ID));
  });

  it('forced vassalage (plan §M15): demands vassalize instead of land once the win is overwhelming', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 90, battleScore: 40 });
    const terms = buildAITerms(state, war, US_ID);
    expect(terms).toEqual([{ type: 'vassalize' }]);
  });

  it('does not demand vassalize when the recipient is already someone else\'s vassal', () => {
    const state = usState();
    const alreadyAVassal = { ...state, nations: { ...state.nations, [CA_ID]: { ...state.nations[CA_ID], vassalOf: MX_ID } } };
    const war = warWithOccupiedCapital(alreadyAVassal, { score: 90, battleScore: 40 });
    const terms = buildAITerms(alreadyAVassal, war, US_ID);
    expect(terms).toEqual([{ type: 'reparations' }]);
  });

  it('does not demand vassalize for a merely decisive (not overwhelming) win', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const terms = buildAITerms(state, war, US_ID);
    expect(terms).not.toContainEqual({ type: 'vassalize' });
  });
});

