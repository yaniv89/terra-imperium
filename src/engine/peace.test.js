import { describe, it, expect } from 'vitest';
import { getTermCost, getPeaceCost, getMaxPeaceCost, getPeaceAcceptance, applyPeace, buildAITerms } from './peace';
import { createInitialState } from '../context/GameContext';
import { getNationCapital } from '../data/regions';

const cap = getNationCapital;
const usState = () => createInitialState({ playerNationId: 'us' });

// A minimal war record between the US (aggressor) and Canada (enemy), with Canada's capital
// occupied by the US — the shared starting point for most of these tests.
const warWithOccupiedCapital = (state, overrides = {}) => ({
  id: 'war_1', aggressor: 'us', enemy: 'ca', active: true, goalAchieved: false,
  startYear: state.year, startTurn: state.turnNumber, cb: 'none',
  battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0,
  goal: { type: 'capture_region', regionId: cap('ca') },
  ...overrides
});

describe('getTermCost', () => {
  it('cede: scales with the ceded region\'s share of the recipient\'s total development', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const cost = getTermCost(state, war, 'us', { type: 'cede', regionId: cap('ca') });
    expect(cost).toBeGreaterThanOrEqual(3);
    expect(cost).toBeLessThanOrEqual(100);
  });

  it('cede: is infinite (unpayable) for a region the recipient does not own', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, 'us', { type: 'cede', regionId: cap('us') })).toBe(Infinity);
  });

  it('cede: is discounted when the war has a claim casus belli', () => {
    const state = usState();
    const claimed = getTermCost(state, warWithOccupiedCapital(state, { cb: 'claim' }), 'us', { type: 'cede', regionId: cap('ca') });
    const unclaimed = getTermCost(state, warWithOccupiedCapital(state, { cb: 'none' }), 'us', { type: 'cede', regionId: cap('ca') });
    expect(claimed).toBeLessThanOrEqual(unclaimed);
  });

  it('gold: divides the amount by a flat divisor, capped', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, 'us', { type: 'gold', amount: 500 })).toBe(1);
    expect(getTermCost(state, war, 'us', { type: 'gold', amount: 50000 })).toBe(30); // capped
  });

  it('reparations and humiliate are flat costs', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, 'us', { type: 'reparations' })).toBe(15);
    expect(getTermCost(state, war, 'us', { type: 'humiliate' })).toBe(15);
  });

  it('vassalize scales with the offerer\'s dev share', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getTermCost(state, war, 'us', { type: 'vassalize' })).toBeGreaterThanOrEqual(60);
  });
});

describe('getPeaceCost', () => {
  it('sums every term\'s cost', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const terms = [{ type: 'reparations' }, { type: 'humiliate' }];
    expect(getPeaceCost(state, war, 'us', terms)).toBe(30);
  });

  it('is 0 for a white peace (no terms)', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    expect(getPeaceCost(state, war, 'us', [])).toBe(0);
  });
});

describe('getMaxPeaceCost', () => {
  it('scales with how much the offerer is winning by, capped at 100', () => {
    const war = { aggressor: 'us', enemy: 'ca', score: 40 };
    expect(getMaxPeaceCost(war, 'us')).toBe(50);
    expect(getMaxPeaceCost(war, 'ca')).toBe(10); // ca is losing (score -40 from its own view): only the flat floor
  });

  it('never exceeds 100', () => {
    const war = { aggressor: 'us', enemy: 'ca', score: 100 };
    expect(getMaxPeaceCost(war, 'us')).toBe(100);
  });
});

describe('getPeaceAcceptance', () => {
  it('accepts a free white peace when the recipient is losing badly', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const result = getPeaceAcceptance(state, war, 'us', []);
    expect(result.cost).toBe(0);
    expect(result.accepted).toBe(true);
  });

  it('rejects demands the recipient has no reason to accept when the war is even', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 0 });
    const result = getPeaceAcceptance(state, war, 'us', [{ type: 'vassalize' }]);
    expect(result.accepted).toBe(false);
  });

  it('is more willing to accept the worse the recipient\'s war exhaustion', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 0 });
    const calm = getPeaceAcceptance(state, war, 'us', [{ type: 'reparations' }]);
    const exhaustedState = { ...state, nations: { ...state.nations, ca: { ...state.nations.ca, warExhaustion: 100 } } };
    const exhausted = getPeaceAcceptance(exhaustedState, war, 'us', [{ type: 'reparations' }]);
    expect(exhausted.total).toBeGreaterThan(calm.total);
  });
});

describe('applyPeace', () => {
  it('cede: transfers ownership, sets formerOwner, and accrues Aggressive Expansion', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const result = applyPeace(occupiedState, war, 'us', [{ type: 'cede', regionId: cap('ca') }]);
    expect(result.regions[cap('ca')].owner).toBe('us');
    expect(result.regions[cap('ca')].occupiedBy).toBeUndefined();
    expect(result.regions[cap('ca')].formerOwner).toBe('ca');
    expect(result.nations.ca.ae?.us).toBeGreaterThan(0);
  });

  it('liberates any occupied-but-not-ceded regions between the two belligerents', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const result = applyPeace(occupiedState, war, 'us', []); // white peace: nothing ceded
    expect(result.regions[cap('ca')].owner).toBe('ca');
    expect(result.regions[cap('ca')].occupiedBy).toBeUndefined();
  });

  it('does not disturb occupation from an unrelated third party', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    // Mexico happens to be occupying the US's capital in some OTHER war — unrelated to this peace.
    const withThirdParty = { ...state, regions: { ...state.regions, [cap('us')]: { ...state.regions[cap('us')], occupiedBy: 'mx' } } };
    const result = applyPeace(withThirdParty, war, 'us', []);
    expect(result.regions[cap('us')].occupiedBy).toBe('mx');
  });

  it('gold: only moves state.resources when the player is a party to the deal', () => {
    const state = { ...usState(), resources: { ...usState().resources, gold: 1000 } };
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, 'us', [{ type: 'gold', amount: 300 }]);
    expect(result.resources.gold).toBe(1300);
  });

  it('gold: is a cosmetic no-op between two AI nations (no simulated AI treasury pre-M16)', () => {
    const state = usState();
    const aiWar = { ...warWithOccupiedCapital(state), aggressor: 'mx', enemy: 'ca' };
    const result = applyPeace(state, aiWar, 'mx', [{ type: 'gold', amount: 300 }]);
    expect(result.resources).toBe(state.resources);
  });

  it('reparations: applies opposite-signed timed goldMult modifiers to winner and loser', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, 'us', [{ type: 'reparations' }]);
    const winnerMod = result.nations.us.modifiers.find(m => m.label === 'War Reparations');
    const loserMod = result.nations.ca.modifiers.find(m => m.label === 'War Reparations');
    expect(winnerMod.mods['national.goldMult']).toBeGreaterThan(0);
    expect(loserMod.mods['national.goldMult']).toBeLessThan(0);
  });

  it('humiliate: raises the winner\'s prestige and lowers the loser\'s prestige and stability', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, 'us', [{ type: 'humiliate' }]);
    expect(result.nations.us.prestige).toBeGreaterThan(state.nations.us.prestige);
    expect(result.nations.ca.prestige).toBeLessThan(state.nations.ca.prestige);
    expect(result.nations.ca.stability).toBeLessThan(state.nations.ca.stability);
  });

  it('vassalize: makes the recipient a vassal of the offerer', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, 'us', [{ type: 'vassalize' }]);
    expect(result.nations.ca.vassalOf).toBe('us');
    expect(result.nations.us.vassals).toContain('ca');
  });

  it('a losing aggressor can offer terms too — otherSide resolves from either direction', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { aggressor: 'ca', enemy: 'us' });
    const occupiedState = { ...state, regions: { ...state.regions, [cap('us')]: { ...state.regions[cap('us')], occupiedBy: 'ca' } } };
    const result = applyPeace(occupiedState, war, 'ca', [{ type: 'cede', regionId: cap('us') }]);
    expect(result.regions[cap('us')].owner).toBe('ca');
  });

  it('capital lost in peace (plan §M15): the recipient auto-relocates its capital and loses stability', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const occupiedState = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const result = applyPeace(occupiedState, war, 'us', [{ type: 'cede', regionId: cap('ca') }]);
    expect(result.nations.ca.capitalRegionId).not.toBe(cap('ca'));
    expect(result.regions[result.nations.ca.capitalRegionId].owner).toBe('ca');
    expect(result.nations.ca.stability).toBe((occupiedState.nations.ca.stability || 0) - 2);
  });

  it('does not relocate the capital when a peace deal leaves it in the recipient\'s hands', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state);
    const result = applyPeace(state, war, 'us', []); // white peace
    expect(result.nations.ca.capitalRegionId).toBe(state.nations.ca.capitalRegionId);
  });
});

describe('buildAITerms', () => {
  it('demands the occupied goal region when it is affordable', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const occupiedState = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const terms = buildAITerms(occupiedState, war, 'us');
    expect(terms).toContainEqual({ type: 'cede', regionId: cap('ca') });
  });

  it('falls back to reparations when nothing occupied is affordable to cede', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { goal: { type: 'destroy_military', threshold: 1 }, battleScore: 40, score: 40 });
    const terms = buildAITerms(state, war, 'us');
    expect(terms).toEqual([{ type: 'reparations' }]);
  });

  it('offers a white peace when even reparations exceed the justified budget', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { goal: { type: 'destroy_military', threshold: 1 }, battleScore: 0, score: 0 });
    const terms = buildAITerms(state, war, 'us');
    expect(terms).toEqual([]);
  });

  it('never demands more than the region-cost cap of dev share', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const occupiedState = { ...state, regions: { ...state.regions, [cap('ca')]: { ...state.regions[cap('ca')], occupiedBy: 'us' } } };
    const terms = buildAITerms(occupiedState, war, 'us');
    const cost = getPeaceCost(occupiedState, war, 'us', terms);
    expect(cost).toBeLessThanOrEqual(getMaxPeaceCost(war, 'us'));
  });

  it('forced vassalage (plan §M15): demands vassalize instead of land once the win is overwhelming', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { score: 90, battleScore: 40 });
    const terms = buildAITerms(state, war, 'us');
    expect(terms).toEqual([{ type: 'vassalize' }]);
  });

  it('does not demand vassalize when the recipient is already someone else\'s vassal', () => {
    const state = usState();
    const alreadyAVassal = { ...state, nations: { ...state.nations, ca: { ...state.nations.ca, vassalOf: 'mx' } } };
    const war = warWithOccupiedCapital(alreadyAVassal, { score: 90, battleScore: 40 });
    const terms = buildAITerms(alreadyAVassal, war, 'us');
    expect(terms).toEqual([{ type: 'reparations' }]);
  });

  it('does not demand vassalize for a merely decisive (not overwhelming) win', () => {
    const state = usState();
    const war = warWithOccupiedCapital(state, { battleScore: 40, score: 40 });
    const terms = buildAITerms(state, war, 'us');
    expect(terms).not.toContainEqual({ type: 'vassalize' });
  });
});

