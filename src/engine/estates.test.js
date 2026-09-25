import { describe, it, expect } from 'vitest';
import { getEstateLoyaltyTarget, getEstateInfluence, processEstatesTurn, canDoEstateInteraction } from './estates';
import { createInitialEstates, ESTATE_LOYALTY_EQUILIBRIUM } from '../data/estates';
import { DEFAULT_LAWS } from '../data/laws';

const baseNation = () => ({ id: 'fr', government: { type: 'tribal', reforms: {} }, laws: { ...DEFAULT_LAWS }, estates: createInitialEstates() });

describe('getEstateLoyaltyTarget', () => {
  it('is the plain equilibrium with no privileges/reforms/laws/traits', () => {
    expect(getEstateLoyaltyTarget(baseNation(), 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM);
  });

  it('rises with a granted privilege\'s loyaltyBonus', () => {
    const nation = baseNation();
    nation.estates.clergy = { ...nation.estates.clergy, privileges: ['religious_tax_exemption'] }; // +15
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM + 15);
  });

  it('rises with an active reform\'s estateLoyalty targeting that estate specifically', () => {
    const nation = { ...baseNation(), government: { type: 'monarchy', reforms: { bronze: 'divine_kingship' } } }; // clergy +10
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM + 10);
    expect(getEstateLoyaltyTarget(nation, 'nobility')).toBe(ESTATE_LOYALTY_EQUILIBRIUM); // untouched
  });

  it('rises with an active law\'s estateLoyalty', () => {
    const nation = { ...baseNation(), laws: { ...DEFAULT_LAWS, religion: 'established_church' } }; // clergy +10
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM + 10);
  });

  it('a ruler trait targeting `all` applies to every estate', () => {
    const nation = { ...baseNation(), ruler: { traits: ['kind'] } }; // all +10
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM + 10);
    expect(getEstateLoyaltyTarget(nation, 'nobility')).toBe(ESTATE_LOYALTY_EQUILIBRIUM + 10);
  });

  it('stacks every source together and clamps to [0, 100]', () => {
    const nation = {
      ...baseNation(),
      government: { type: 'monarchy', reforms: { bronze: 'divine_kingship' } }, // clergy +10
      laws: { ...DEFAULT_LAWS, religion: 'established_church' }, // clergy +10
      ruler: { traits: ['kind'] } // all +10
    };
    nation.estates.clergy = { ...nation.estates.clergy, privileges: ['religious_tax_exemption'] }; // +15
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(50 + 10 + 10 + 10 + 15);
  });

  it('the Secularism law lowers clergy loyalty', () => {
    const nation = { ...baseNation(), laws: { ...DEFAULT_LAWS, religion: 'secularism' } };
    expect(getEstateLoyaltyTarget(nation, 'clergy')).toBe(ESTATE_LOYALTY_EQUILIBRIUM - 10);
  });
});

describe('getEstateInfluence', () => {
  it('is 10 with no privileges for a fresh estate', () => {
    const state = { playerNationId: 'fr', nations: { fr: baseNation() }, regions: {} };
    expect(getEstateInfluence(state, 'fr', 'clergy')).toBe(10);
  });

  it('adds 10 per granted privilege', () => {
    const nation = baseNation();
    nation.estates.clergy = { ...nation.estates.clergy, privileges: ['religious_tax_exemption', 'control_of_education'] };
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions: {} };
    expect(getEstateInfluence(state, 'fr', 'clergy')).toBe(30); // 10 + 10x2
  });

  it('adds land share from owned region count, for the player only', () => {
    const nation = baseNation();
    const regions = { r1: { owner: 'fr' }, r2: { owner: 'fr' }, r3: { owner: 'de' } };
    const playerState = { playerNationId: 'fr', nations: { fr: nation, de: baseNation() }, regions };
    expect(getEstateInfluence(playerState, 'fr', 'clergy')).toBe(12); // 10 + 2 owned regions
    expect(getEstateInfluence(playerState, 'de', 'clergy')).toBe(10); // AI: cheap privilege-only proxy, no region scan
  });

  it('clergy influence rises with Culture-category buildings, for the player only', () => {
    const nation = baseNation();
    const regions = { r1: { owner: 'fr', buildings: { categories: { culture: 0 } } }, r2: { owner: 'fr', buildings: { categories: { culture: -1 } } } };
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions };
    expect(getEstateInfluence(state, 'fr', 'clergy')).toBe(10 + 2 /* land share */ + 2 /* 1 culture building x2 */);
  });

  it('nobility influence rises with total manpower dev; burghers with tax+production dev', () => {
    const nation = baseNation();
    const regions = { r1: { owner: 'fr', dev: { tax: 5, production: 5, manpower: 20 } } };
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions };
    expect(getEstateInfluence(state, 'fr', 'nobility')).toBe(10 + 1 /* land share */ + 2 /* round(20/10) */);
    expect(getEstateInfluence(state, 'fr', 'burghers')).toBe(10 + 1 + 1 /* round(10/10) */);
  });

  it('a reform/law estateInfluence bonus applies to both the player and AI', () => {
    const nation = { ...baseNation(), government: { type: 'theocracy', reforms: { bronze: 'temple_state' } } }; // clergy +15
    const state = { playerNationId: 'fr', nations: { fr: nation, de: nation }, regions: {} };
    expect(getEstateInfluence(state, 'fr', 'clergy')).toBe(25);
    expect(getEstateInfluence(state, 'de', 'clergy')).toBe(25);
  });

  it('returns 0 for a nation with no such estate', () => {
    const state = { playerNationId: 'fr', nations: { fr: { estates: {} } }, regions: {} };
    expect(getEstateInfluence(state, 'fr', 'labor')).toBe(0);
  });
});

describe('processEstatesTurn', () => {
  it('steps loyalty by exactly 1 toward its target, never jumping', () => {
    const nation = baseNation();
    nation.estates.clergy = { ...nation.estates.clergy, loyalty: 50, privileges: ['religious_tax_exemption'] }; // target 65
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions: {} };
    const estates = processEstatesTurn(state, 'fr');
    expect(estates.clergy.loyalty).toBe(51);
  });

  it('steps downward when the target is below current loyalty', () => {
    const nation = baseNation();
    nation.estates.clergy = { ...nation.estates.clergy, loyalty: 60 }; // target 50
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions: {} };
    expect(processEstatesTurn(state, 'fr').clergy.loyalty).toBe(59);
  });

  it('does not move once already at the target', () => {
    const nation = baseNation();
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions: {} };
    expect(processEstatesTurn(state, 'fr').clergy.loyalty).toBe(50);
  });

  it('also refreshes influence every turn', () => {
    const nation = baseNation();
    nation.estates.clergy = { ...nation.estates.clergy, influence: 999 }; // stale
    const state = { playerNationId: 'fr', nations: { fr: nation }, regions: {} };
    expect(processEstatesTurn(state, 'fr').clergy.influence).toBe(10);
  });

  it('returns the SAME estates reference when nothing changed at all', () => {
    const nation = baseNation();
    const state = { playerNationId: 'de', nations: { de: nation }, regions: {} }; // AI: loyalty at target, influence stable
    expect(processEstatesTurn(state, 'de')).toBe(nation.estates);
  });

  it('is safe for a nation with no estates field at all', () => {
    const state = { playerNationId: 'fr', nations: { fr: {} }, regions: {} };
    expect(processEstatesTurn(state, 'fr')).toBeUndefined();
  });
});

describe('canDoEstateInteraction', () => {
  it('allows when no cooldown has ever been set', () => {
    expect(canDoEstateInteraction({}, 'seizeLand', 10)).toBe(true);
  });

  it('rejects while the turn number is before the cooldown', () => {
    expect(canDoEstateInteraction({ estateInteractionCooldowns: { seizeLand: 20 } }, 'seizeLand', 10)).toBe(false);
  });

  it('allows once the turn number reaches the cooldown', () => {
    expect(canDoEstateInteraction({ estateInteractionCooldowns: { seizeLand: 20 } }, 'seizeLand', 20)).toBe(true);
  });
});
