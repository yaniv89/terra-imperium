// src/data/startingDoctrines.js
// Plan §M18: "STARTING_DOCTRINES is re-authored with real, small rewards ... Each is gated by an
// achievement." Every reward below hooks into an already-real, already-wired system rather than a
// flat resource bump alone — deliberately modest (a nation's own first-turn numbers, not a
// decisive advantage), matching this file's own original design note.
//
// Adapted from the plan's own example list: "+1 diplomat" names a system this codebase never
// built (no diplomat count/task mechanic exists — src/engine/succession.js's own header comment on
// advisors already makes the same trim for "the plan's per-advisor flavor bonus table"). +5
// legitimacy takes that reward's place: a real, wired field of comparable modesty.
import { getCapital } from './regions';
import { clampPrestige, clampLegitimacy } from '../engine/nationalPower';
import { generateGivenName } from './names';
import { createRng } from '../utils/rng';

export const STARTING_DOCTRINES = {
  none: {
    id: 'none',
    name: 'Standard Start',
    description: 'No bonus.',
    requiresAchievement: null,
    apply: (state) => state
  },
  administrators_start: {
    id: 'administrators_start',
    name: "Administrator's Start",
    description: '+50 ADM at the start of the game.',
    requiresAchievement: 'iron_grip',
    apply: (state) => ({ ...state, resources: { ...state.resources, adm: (state.resources.adm || 0) + 50 } })
  },
  restored_reputation: {
    id: 'restored_reputation',
    name: 'Restored Reputation',
    description: '+10 prestige at the start of the game.',
    requiresAchievement: 'phoenix',
    apply: (state) => {
      const player = state.nations[state.playerNationId];
      return { ...state, nations: { ...state.nations, [state.playerNationId]: { ...player, prestige: clampPrestige((player.prestige || 0) + 10) } } };
    }
  },
  veteran_diplomacy: {
    id: 'veteran_diplomacy',
    name: 'Veteran Diplomacy',
    description: '+5 legitimacy at the start of the game.',
    requiresAchievement: 'great_game',
    apply: (state) => {
      const player = state.nations[state.playerNationId];
      return { ...state, nations: { ...state.nations, [state.playerNationId]: { ...player, legitimacy: clampLegitimacy((player.legitimacy ?? 50) + 5) } } };
    }
  },
  master_builder: {
    id: 'master_builder',
    name: 'Master Builder',
    description: 'Start with a free Shrine (Culture) in your capital.',
    requiresAchievement: 'builder_of_wonders',
    apply: (state) => {
      const capitalId = getCapital(state, state.playerNationId);
      const region = state.regions[capitalId];
      if (!region) return state;
      const categories = region.buildings?.categories || {};
      if ((categories.culture ?? -1) !== -1) return state; // already built there — no free upgrade, no downgrade
      return { ...state, regions: { ...state.regions, [capitalId]: { ...region, buildings: { ...region.buildings, categories: { ...categories, culture: 0 } } } } };
    }
  },
  // The one doctrine whose reward needs the rng applyStartingDoctrine threads through (a named
  // advisor) rather than a flat number — kept last so the simpler, rng-free doctrines above read
  // as the common case.
  seasoned_court: {
    id: 'seasoned_court',
    name: 'A Seasoned Court',
    description: 'Start with a free, experienced Administrative advisor.',
    requiresAchievement: 'dynasty',
    apply: (state, rng) => {
      const player = state.nations[state.playerNationId];
      if (player.advisors?.adm) return state; // a slot already filled keeps its own advisor
      const advisor = { id: 'starting_advisor_adm', name: generateGivenName(state.playerNationId, rng), level: 2 };
      return { ...state, nations: { ...state.nations, [state.playerNationId]: { ...player, advisors: { ...player.advisors, adm: advisor } } } };
    }
  }
};

// Pure: applies a starting doctrine's bonus onto a freshly-created state. Falls back to the state
// unchanged for an unknown/'none' id rather than throwing, since the caller only ever has a
// persisted id (from localStorage) with no guarantee the catalog above hasn't changed. Consumes
// `state.rngSeed` (for the one doctrine that names an advisor) and advances it, so this never
// breaks the replay-determinism a fresh game's own seed already guarantees.
export const applyStartingDoctrine = (state, doctrineId) => {
  const doctrine = STARTING_DOCTRINES[doctrineId];
  if (!doctrine) return state;
  const rng = createRng(state.rngSeed);
  const next = doctrine.apply(state, rng);
  return next === state ? next : { ...next, rngSeed: rng.getSeed() };
};
