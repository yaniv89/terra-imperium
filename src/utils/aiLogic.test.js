import { describe, it, expect } from 'vitest';
import {
  processAINationTurn, processAllAINations, getRelationFromHostility,
  getNationTier, getSortedByMilitary, processAIWarDecisions, findRunawayLeader,
  chooseAIRecruitClass, processAIRecruitment
} from './aiLogic';
import { createRng } from './rng';
import { RelationStatus } from '../data/types';

const aiNation = (overrides = {}) => ({
  id: 'fr',
  isPlayer: false,
  isAtWar: false,
  hostility: 50,
  hostilityFloor: 0,
  militaryStrength: 15000,
  aggression: 0.1,
  doctrine: 'cautious',
  ...overrides
});

describe('processAINationTurn', () => {
  it('is a no-op for the player\'s own nation', () => {
    const updates = processAINationTurn({ ...aiNation(), isPlayer: true }, {}, 1950, createRng(1));
    expect(updates).toEqual({ militaryStrengthChange: 0, hostilityChange: 0, logs: [] });
  });

  it('grows military strength over time', () => {
    const updates = processAINationTurn(aiNation(), {}, 1950, createRng(5));
    expect(updates.militaryStrengthChange).toBeGreaterThan(0);
  });

  it('decays hostility down toward its floor', () => {
    const updates = processAINationTurn(aiNation({ hostility: 50, hostilityFloor: 10 }), {}, 1950, createRng(5));
    expect(updates.hostilityChange).toBeLessThan(0);
  });

  it('does not decay hostility once at its floor', () => {
    const updates = processAINationTurn(aiNation({ hostility: 10, hostilityFloor: 10 }), {}, 1950, createRng(5));
    expect(updates.hostilityChange).toBe(0);
  });

  it('is deterministic given the same rng sequence', () => {
    const a = processAINationTurn(aiNation(), {}, 1950, createRng(99));
    const b = processAINationTurn(aiNation(), {}, 1950, createRng(99));
    expect(a).toEqual(b);
  });
});

describe('processAllAINations', () => {
  it('produces a growth/hostility update for every non-player nation, and none for the player', () => {
    const state = {
      nations: {
        fr: aiNation({ id: 'fr' }),
        de: aiNation({ id: 'de' }),
        us: { ...aiNation({ id: 'us' }), isPlayer: true }
      }
    };
    const result = processAllAINations(state, 1950, createRng(1));
    expect(Object.keys(result.nationUpdates).sort()).toEqual(['de', 'fr']);
  });
});

// Real region ids doubling as nation ids (Phase A's one-whole-country-region-per-nation model —
// see src/data/regions.js). us<->ca<->mx and de<->{cz,pl,at,be,fr,...} are real adjacency from
// worldRegions.json; 'au' (Australia) has no neighbors, making it a real Tier 3 fixture.
describe('getNationTier', () => {
  const baseState = (nationOverrides = {}) => ({
    playerNationId: 'us',
    nations: {
      us: { id: 'us', isPlayer: true },
      ca: { id: 'ca', isPlayer: false, isAtWar: false, ...nationOverrides.ca },
      mx: { id: 'mx', isPlayer: false, isAtWar: false, ...nationOverrides.mx },
      de: { id: 'de', isPlayer: false, isAtWar: false, ...nationOverrides.de },
      fr: { id: 'fr', isPlayer: false, isAtWar: false, ...nationOverrides.fr },
      au: { id: 'au', isPlayer: false, isAtWar: false, ...nationOverrides.au }
    }
  });

  it('returns null for the player\'s own nation', () => {
    expect(getNationTier(baseState(), 'us', [])).toBeNull();
  });

  it('is Tier 1 for a nation at war, regardless of geography or rank', () => {
    const state = baseState({ fr: { isAtWar: true } });
    expect(getNationTier(state, 'fr', [])).toBe(1);
  });

  it('is Tier 1 for a nation bordering the player, even unranked and at peace', () => {
    const state = baseState();
    expect(getNationTier(state, 'ca', [])).toBe(1);
  });

  it('is Tier 1 for a top-20-by-military nation even if distant from the player', () => {
    const state = baseState();
    expect(getNationTier(state, 'de', ['de'])).toBe(1);
  });

  it('is Tier 2 for a nation with neighbors that is neither bordering the player nor top-ranked', () => {
    const state = baseState();
    expect(getNationTier(state, 'de', [])).toBe(2);
  });

  it('is Tier 3 for a nation with no neighbors, not bordering the player or top-ranked', () => {
    const state = baseState();
    expect(getNationTier(state, 'au', [])).toBe(3);
  });
});

describe('getSortedByMilitary', () => {
  it('ranks non-player nations by military strength, descending, excluding the player', () => {
    const state = {
      nations: {
        us: { id: 'us', isPlayer: true, militaryStrength: 999999 },
        fr: { id: 'fr', isPlayer: false, militaryStrength: 500 },
        de: { id: 'de', isPlayer: false, militaryStrength: 1500 },
        ca: { id: 'ca', isPlayer: false, militaryStrength: 1000 }
      }
    };
    expect(getSortedByMilitary(state)).toEqual(['de', 'ca', 'fr']);
  });
});

describe('processAIWarDecisions', () => {
  const dovishRng = { next: () => 0.999 }; // never below any war-roll chance
  const hawkishRng = { next: () => 0 }; // always below any positive war-roll chance

  // Padding nations so no nation in the small fixture below accidentally clears
  // COALITION_MILITARY_SHARE_THRESHOLD and pulls coalition behavior into tests that aren't about
  // it. None individually exceeds the threshold either. They aren't real-world neighbors of
  // anything below, so they never enter tier/target calculations — only the world military total
  // findRunawayLeader sums over.
  const padding = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`zz${i}`, { id: `zz${i}`, name: `Padding ${i}`, isPlayer: false, isAtWar: false, hostility: 0, militaryStrength: 4000 }])
  );

  const warState = (nationOverrides = {}) => ({
    playerNationId: 'us',
    year: 1950,
    nations: {
      us: { id: 'us', name: 'United States', isPlayer: true, isAtWar: false, militaryStrength: 5000 },
      de: {
        id: 'de', name: 'Germany', isPlayer: false, isAtWar: false, hostility: 90, hostilityFloor: 0,
        doctrine: 'conqueror', militaryStrength: 5000, ...nationOverrides.de
      },
      fr: { id: 'fr', name: 'France', isPlayer: false, isAtWar: false, hostility: 10, militaryStrength: 2000, ...nationOverrides.fr },
      be: { id: 'be', name: 'Belgium', isPlayer: false, isAtWar: false, hostility: 10, militaryStrength: 500, ...nationOverrides.be },
      at: { id: 'at', name: 'Austria', isPlayer: false, isAtWar: false, hostility: 10, militaryStrength: 3000, ...nationOverrides.at },
      ...padding
    },
    // assignDefaultWarGoal (src/engine/diplomacy.js) needs a regions map to look for a
    // capture_region target — one region per nation, self-owned, matching the real Phase A model.
    regions: {
      us: { owner: 'us', neighbors: ['ca', 'mx'] },
      de: { owner: 'de', neighbors: ['cz', 'pl', 'at', 'be', 'fr', 'lu', 'dk', 'nl', 'ch'] },
      fr: { owner: 'fr', neighbors: ['br', 'sr', 'be', 'lu', 'de', 'it', 'mc', 'ch', 'es', 'ad'] },
      be: { owner: 'be', neighbors: ['fr', 'nl', 'lu', 'de'] },
      at: { owner: 'at', neighbors: ['cz', 'sk', 'de', 'hu', 'si', 'ch', 'li', 'it'] }
    },
    wars: []
  });

  it('a Tier 1 nation that rolls to declare war attacks its weakest bordering neighbor', () => {
    const state = warState();
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de'], hawkishRng);
    expect(result.nations.de.isAtWar).toBe(true);
    expect(result.nations.be.isAtWar).toBe(true); // be (500) is weaker than fr (2000) and at (3000)
    expect(result.wars).toHaveLength(1);
    expect(result.wars[0]).toMatchObject({ enemy: 'be', aggressor: 'de' });
    expect(result.logs[0].message).toContain('Germany');
    expect(result.logs[0].message).toContain('Belgium');
  });

  it('declares no wars when every roll fails', () => {
    const state = warState();
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de'], dovishRng);
    expect(result.wars).toHaveLength(0);
    expect(result.nations).toBe(state.nations);
  });

  it('skips nations that are not Tier 1', () => {
    // fr/be/at aren't at war, don't border the player, and aren't in sortedByMilitary — Tier 2/3.
    const state = warState();
    const result = processAIWarDecisions(state, state.nations, state.wars, [], hawkishRng);
    expect(result.wars).toHaveLength(0);
  });

  it('skips a nation already at war', () => {
    const state = warState({ de: { isAtWar: true } });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de'], hawkishRng);
    expect(result.wars).toHaveLength(0);
  });

  it('never lets a nation with a non-positive war-roll doctrine declare war', () => {
    // isolationist's warRollMult is a small positive (0.02), not zero, so use hostility 0 and the
    // hawkish rng to prove the *doctrine* gate, not just a low roll, is what's being tested is
    // covered by the shouldDeclareWar chance formula — this asserts the affirmative case works
    // for a low-but-positive doctrine when the roll is guaranteed to succeed.
    const state = warState({ de: { doctrine: 'isolationist', hostility: 100 } });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de'], hawkishRng);
    expect(result.nations.de.isAtWar).toBe(true);
  });

  it('multiple Tier 1 nations can each declare a war in the same turn, threaded sequentially', () => {
    const state = warState({ at: {} });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de', 'at'], hawkishRng);
    expect(result.nations.de.isAtWar).toBe(true);
    expect(result.wars.some(w => w.aggressor === 'de')).toBe(true);
  });

  it('scales the war-roll chance by state.difficultyMultiplier (Task 24)', () => {
    // attrition, hostility 10 -> chance = 0.02 * 1 * aggressionMult * 0.3. At mult 1 that's 0.006,
    // at mult 1.5 (Emperor) it's 0.009 — a fixed roll of 0.007 sits exactly between the two.
    const state = warState({ de: { doctrine: 'attrition', hostility: 10 } });
    const rngAtThreshold = { next: () => 0.007 };
    const normal = processAIWarDecisions({ ...state, difficultyMultiplier: 1 }, state.nations, state.wars, ['de'], rngAtThreshold);
    expect(normal.wars).toHaveLength(0);
    const emperor = processAIWarDecisions({ ...state, difficultyMultiplier: 1.5 }, state.nations, state.wars, ['de'], rngAtThreshold);
    expect(emperor.wars).toHaveLength(1);
  });

  it('a coalition member bordering the runaway leader attacks the leader instead of its normally-weakest neighbor', () => {
    // Belgium (be, 500 strength) normally prefers France (fr, 2000) over the much stronger
    // Germany (de) as its weakest neighbor — but once de is a runaway leader (100000 strength,
    // dominating the fixture's world total), the coalition rule overrides that and sends be after
    // de instead. sortedByMilitary only ranks 'be' Tier 1 here, so de (Tier 2 in this call) never
    // gets to act as an aggressor itself and pre-empt the scenario by declaring on be first.
    const state = warState({ de: { militaryStrength: 100000 } });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['be'], hawkishRng);
    expect(result.wars).toEqual([expect.objectContaining({ aggressor: 'be', enemy: 'de' })]);
    expect(result.logs[0].message).toContain('coalition');
  });

  it('raises a coalition member\'s hostility toward the leader each turn, even when it does not declare war that turn', () => {
    const state = warState({ de: { militaryStrength: 100000 }, be: { hostility: 10 } });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['be'], dovishRng);
    expect(result.wars).toHaveLength(0);
    expect(result.nations.be.hostility).toBe(13);
  });

  it('never raises the runaway leader\'s own hostility as if it were a coalition member', () => {
    const state = warState({ de: { militaryStrength: 100000, hostility: 90 } });
    const result = processAIWarDecisions(state, state.nations, state.wars, ['de'], dovishRng);
    expect(result.nations.de.hostility).toBe(90);
  });
});

describe('findRunawayLeader', () => {
  it('returns null when no nation clears the coalition share threshold', () => {
    // 7 equal nations: the largest share is 1/7 ≈ 14.3%, just under the 15% threshold.
    const nations = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => [id, { id, militaryStrength: 100 }]));
    expect(findRunawayLeader(nations)).toBeNull();
  });

  it('returns the id of a nation holding a runaway share of world military strength', () => {
    const nations = { a: { id: 'a', militaryStrength: 5000 }, b: { id: 'b', militaryStrength: 500 }, c: { id: 'c', militaryStrength: 500 } };
    expect(findRunawayLeader(nations)).toBe('a');
  });

  it('can name the player as the runaway leader — coalitions form against a snowballing player too', () => {
    const nations = { us: { id: 'us', isPlayer: true, militaryStrength: 9000 }, fr: { id: 'fr', militaryStrength: 500 } };
    expect(findRunawayLeader(nations)).toBe('us');
  });

  it('returns null for an empty world or a world with zero total military', () => {
    expect(findRunawayLeader({})).toBeNull();
    expect(findRunawayLeader({ a: { id: 'a', militaryStrength: 0 } })).toBeNull();
  });
});

describe('getRelationFromHostility', () => {
  it('war overrides everything', () => {
    expect(getRelationFromHostility(0, true, true, true)).toBe(RelationStatus.WAR);
  });

  it('trade agreement reads as friendly', () => {
    expect(getRelationFromHostility(90, false, false, true)).toBe(RelationStatus.FRIENDLY);
  });

  it('peace treaty reads as cold peace', () => {
    expect(getRelationFromHostility(90, false, true, false)).toBe(RelationStatus.COLD_PEACE);
  });

  it('high hostility with no treaty reads as hostile', () => {
    expect(getRelationFromHostility(85, false, false, false)).toBe(RelationStatus.HOSTILE);
  });

  it('low hostility with no treaty reads as neutral', () => {
    expect(getRelationFromHostility(10, false, false, false)).toBe(RelationStatus.NEUTRAL);
  });
});

// Task 36: counter-building. de/fr/be/at reuse the same real-adjacency fixture as the war-decision
// tests above — de borders fr, at, be for real (worldRegions.json).
describe('chooseAIRecruitClass', () => {
  const state = (overrides = {}) => ({
    playerNationId: 'us',
    wars: [],
    nations: { de: { id: 'de' }, fr: { id: 'fr' }, us: { id: 'us', isPlayer: true } },
    ...overrides
  });

  const unit = (ownerId, classId) => ({ ownerId, classId });

  it('recruits the counter to its rival\'s dominant class — cavalry-heavy fr makes de build infantry', () => {
    const units = {
      u1: unit('fr', 'cavalry'), u2: unit('fr', 'cavalry'), u3: unit('fr', 'cavalry'), u4: unit('fr', 'ranged')
    };
    // de borders fr for real, and fr isn't the player, so fr is de's rival by neighbor fallback.
    expect(chooseAIRecruitClass(state(), units, 'de', 'classical')).toBe('infantry');
  });

  it('recruits the counter to a ranged-heavy rival: cavalry', () => {
    const units = { u1: unit('fr', 'ranged'), u2: unit('fr', 'ranged'), u3: unit('fr', 'infantry') };
    expect(chooseAIRecruitClass(state(), units, 'de', 'classical')).toBe('cavalry');
  });

  it('prefers a live war opponent over a bordering nation as the rival to react to', () => {
    // 'at' isn't even in this fixture's nations map, so the neighbor-fallback path could never
    // reach it — only the war lookup can, proving war takes priority over bordering-nation fallback.
    const units = { u1: unit('at', 'cavalry'), u2: unit('at', 'cavalry'), u3: unit('fr', 'ranged') };
    const withWar = state({ wars: [{ enemy: 'at', aggressor: 'de', active: true }] });
    expect(chooseAIRecruitClass(withWar, units, 'de', 'classical')).toBe('infantry');
  });

  it('falls back to infantry when the rival has no units yet', () => {
    expect(chooseAIRecruitClass(state(), {}, 'de', 'classical')).toBe('infantry');
  });

  it('falls back to infantry when the rival\'s dominant class has no recruitable counter (e.g. all-support)', () => {
    const units = { u1: unit('fr', 'support') };
    expect(chooseAIRecruitClass(state(), units, 'de', 'classical')).toBe('infantry');
  });

  it('never recruits a class that is not yet available this age', () => {
    // bronze has no siege counter for cavalry other than itself being beaten by cavalry — infantry
    // is still the real counter and is available every age, so this just confirms no crash/undefined.
    const units = { u1: unit('fr', 'cavalry') };
    expect(chooseAIRecruitClass(state(), units, 'de', 'bronze')).toBe('infantry');
  });
});

describe('processAIRecruitment', () => {
  const alwaysRecruit = { next: () => 0 }; // always clears AI_RECRUIT_CHANCE
  const neverRecruit = { next: () => 0.999 };

  const baseState = () => ({
    playerNationId: 'us',
    wars: [],
    turnNumber: 42,
    nations: {
      us: { id: 'us', isPlayer: true },
      de: { id: 'de', isPlayer: false, isAtWar: false, militaryStrength: 5000 },
      fr: { id: 'fr', isPlayer: false, isAtWar: false, militaryStrength: 2000 }
    },
    regions: {
      de: { owner: 'de', currentPopulation: 1000 },
      de2: { owner: 'de', currentPopulation: 5000 },
      fr: { owner: 'fr', currentPopulation: 1000 }
    }
  });

  it('recruits a real unit for a Tier 1 nation, spends militaryStrength, and places it in its most populous region', () => {
    const state = baseState();
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], 'classical', alwaysRecruit);
    const recruited = Object.values(result.units).find(u => u.ownerId === 'de');
    expect(recruited).toBeDefined();
    expect(recruited.regionId).toBe('de2'); // more populous than 'de'
    expect(recruited.domain).toBe('land');
    expect(result.nations.de.militaryStrength).toBe(5000 - 300);
  });

  it('does nothing for a Tier 2/3 nation (not in sortedByMilitary, no war, no player border)', () => {
    const state = baseState();
    const result = processAIRecruitment(state, {}, state.nations, state.regions, [], 'classical', alwaysRecruit);
    expect(Object.keys(result.units)).toHaveLength(0);
  });

  it('never recruits for the player', () => {
    const state = baseState();
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['us'], 'classical', alwaysRecruit);
    expect(Object.values(result.units).some(u => u.ownerId === 'us')).toBe(false);
  });

  it('does nothing when the roll fails', () => {
    const state = baseState();
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], 'classical', neverRecruit);
    expect(Object.keys(result.units)).toHaveLength(0);
    expect(result.nations.de.militaryStrength).toBe(5000);
  });

  it('refuses to recruit below the militaryStrength cost', () => {
    const state = baseState();
    state.nations.de.militaryStrength = 100;
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], 'classical', alwaysRecruit);
    expect(Object.keys(result.units)).toHaveLength(0);
  });

  it('stops recruiting once a nation is at its standing-unit cap', () => {
    const state = baseState();
    const existing = {};
    for (let i = 0; i < 8; i++) existing[`existing_${i}`] = { ownerId: 'de', classId: 'infantry' };
    const result = processAIRecruitment(state, existing, state.nations, state.regions, ['de'], 'classical', alwaysRecruit);
    const newOnes = Object.keys(result.units).filter(id => !existing[id]);
    expect(newOnes).toHaveLength(0);
  });

  it('is deterministic given the same rng sequence', () => {
    const state = baseState();
    const a = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], 'classical', createRng(7));
    const b = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], 'classical', createRng(7));
    expect(a).toEqual(b);
  });
});
