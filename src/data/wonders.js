// src/data/wonders.js
// World Wonders (plan §5/§6): one-per-world megaprojects, age-gated, permanent empire bonus.
// Reuses the same two bonus hooks government types and policies already use (goldMult/hrMult,
// consumed by calcIncome; stabilityBonus, consumed by nextUnrest) via getNationBonusTotal, so a
// finished wonder is just one more term in math that already exists rather than a new system.
//
// Global uniqueness lives on state.wondersBuilt ({ wonderId: builderNationId }), checked here
// before a nation is allowed to start one — only the player can currently trigger Construct
// Wonder (AI economic actions are out of scope until AI nations have real per-region simulation),
// but the map is keyed by nation id, not hardcoded to the player, so AI wonder-building later
// slots into the same check with no rework.
import { getAgeIndex } from './ages';

export const WONDERS = {
  pyramids: {
    id: 'pyramids',
    name: 'The Pyramids',
    age: 'bronze',
    effect: { stabilityBonus: 8 },
    description: 'A monumental tomb complex that awes subjects into order. +8 Stability, empire-wide.'
  },
  greatLibrary: {
    id: 'greatLibrary',
    name: 'The Great Library',
    age: 'classical',
    effect: { hrMult: 0.1, popGrowthBonus: 0.001 },
    description: 'The ancient world\'s foremost archive draws scholars and settlers alike. +10% HR income, +0.1%/turn population growth, empire-wide.'
  },
  grandBazaar: {
    id: 'grandBazaar',
    name: 'The Grand Bazaar',
    age: 'kingdoms',
    effect: { goldMult: 0.15 },
    description: 'A crossroads market that channels trade from every caravan route. +15% Gold income, empire-wide.'
  },
  royalObservatory: {
    id: 'royalObservatory',
    name: 'The Royal Observatory',
    age: 'gunpowder',
    effect: { goldMult: 0.1, stabilityBonus: 5 },
    description: 'Precision navigation and timekeeping pay off across the whole economy. +10% Gold, +5 Stability.'
  },
  spaceProgram: {
    id: 'spaceProgram',
    name: 'The Space Program',
    age: 'modern',
    effect: { goldMult: 0.15, stabilityBonus: 8 },
    description: 'A national point of pride, and the seed of the coming space race. +15% Gold, +8 Stability.'
  }
};

export const WONDER_IDS = Object.keys(WONDERS);

// True if `wonderId` can be started right now: unlocked by the calendar (or one age ahead, the
// same rush allowance every other age-gated system in this game shares — see buildings.js's
// canBuildTier), and not already claimed by any nation anywhere in the world.
export const canConstructWonder = (wonderId, ageId, wondersBuilt) => {
  const wonder = WONDERS[wonderId];
  if (!wonder) return false;
  if (wondersBuilt?.[wonderId]) return false;
  const wonderIdx = getAgeIndex(wonder.age);
  const currentIdx = getAgeIndex(ageId);
  if (currentIdx === -1) return false;
  return wonderIdx <= currentIdx + 1;
};
