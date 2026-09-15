// src/utils/milestones.js
// "Next milestone" dashboard widget (Phase 10) — always shows the player something just out of
// reach (Civ's "just one more turn" mechanism). Progress toward each non-survival victory
// condition (Phase 10) is genuinely computable from state, unlike a projected end-of-game year
// which would need a full simulation to be honest — so this deliberately sticks to concrete,
// verifiable numbers rather than a speculative forecast.

import { GamePhases } from '../data/types';
import { TECH_TREE, canResearchTech } from '../data/techTree';
import { INDEPENDENCE_WAR_ATTACKERS, HOSTILE_BLOCS } from '../data/nations';
import { getNationCapital } from '../data/regions';

const clampFraction = (value) => Math.max(0, Math.min(1, value));

// The cheapest tech (by money cost) the player doesn't have yet and isn't blocked from ever
// researching (year/prereqs/exclusivity) — not necessarily affordable *right now*.
const nextResearchableTech = (state) => {
  const candidates = Object.values(TECH_TREE)
    .filter(tech => !state.techTree[tech.id]?.researched)
    .filter(tech => canResearchTech(tech.id, state.techTree, { money: Infinity, techPoints: Infinity, actionPoints: Infinity }, state.year).can);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.cost.money - b.cost.money);
  const tech = candidates[0];
  const canAffordNow = canResearchTech(tech.id, state.techTree, state.resources, state.year).can;
  return { id: tech.id, name: tech.name, cost: tech.cost, canAffordNow };
};

export const computeMilestones = (state) => {
  if (state.phase !== GamePhases.POST_STATE) return [];

  const milestones = [];

  const tech = nextResearchableTech(state);
  if (tech) {
    milestones.push({
      id: 'next_tech',
      label: `Next Tech: ${tech.name}`,
      progress: clampFraction(state.resources.techPoints / tech.cost.techPoints),
      detail: `${state.resources.techPoints}/${tech.cost.techPoints} TP`
    });
  }

  const capitalsHeld = INDEPENDENCE_WAR_ATTACKERS.filter(nationId => {
    const capital = getNationCapital(nationId);
    return !capital || state.regions[capital]?.owner === 'player';
  }).length;
  milestones.push({
    id: 'military_conquest',
    label: 'Total Regional Victory',
    progress: clampFraction(capitalsHeld / INDEPENDENCE_WAR_ATTACKERS.length),
    detail: `${capitalsHeld}/${INDEPENDENCE_WAR_ATTACKERS.length} capitals held`
  });

  const economicProgress = clampFraction(Math.min(state.resources.money / 5000000, state.resources.techPoints / 2000));
  milestones.push({
    id: 'economic_ascendancy',
    label: 'Economic Ascendancy',
    progress: economicProgress,
    detail: `$${Math.round(state.resources.money / 1000)}K/$5M · ${state.resources.techPoints}/2000 TP`
  });

  const hostileMembers = Object.values(HOSTILE_BLOCS).flat();
  const pacified = hostileMembers.filter(id => {
    const nation = state.nations[id];
    return !nation || nation.hasPeaceTreaty || nation.hasTradeAgreement;
  }).length;
  milestones.push({
    id: 'diplomatic_hegemony',
    label: 'Diplomatic Hegemony',
    progress: clampFraction(pacified / hostileMembers.length),
    detail: `${pacified}/${hostileMembers.length} nations at peace or trading`
  });

  // Closest-to-completion first — that's the one worth showing the player is "just out of reach".
  return milestones.sort((a, b) => b.progress - a.progress);
};
