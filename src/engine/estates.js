// src/engine/estates.js
// Plan §M9: loyalty drift, influence, and interaction cooldowns. Mirrors succession.js/
// nationalPower.js's shape — pure functions, no state dependency beyond what's passed in; the
// caller (resolveTurn.js) writes the result back onto the nation.
import { ESTATE_LOYALTY_EQUILIBRIUM, getPrivilege } from '../data/estates';
import { getActiveReforms } from '../data/government';
import { getLaw } from '../data/laws';
import { TRAITS } from '../data/traits';
import { GREAT_PROJECTS, getGreatProjectOwner } from '../data/greatProjects';

const sumRawEstateEffect = (effect, estateId) => {
  if (!effect) return 0;
  return (effect[estateId] || 0) + (effect.all || 0);
};

// Bug fix (plan feedback: "issue with great works" — the Colosseum/Great Cathedral/Palace of
// Versailles descriptions all promise a real estateLoyalty bonus, but nothing ever read it): every
// great project this nation currently owns (ownership derived from its site region, same as
// src/engine/modifiers/sources.js's own contextSources reads it), at its current tier's effects.
const getOwnedGreatProjectEstateLoyaltyEffects = (state, nationId) =>
  Object.entries(state?.greatProjects || {})
    .filter(([projectId, entry]) => entry?.tier && getGreatProjectOwner(state, projectId) === nationId)
    .map(([projectId, entry]) => GREAT_PROJECTS[projectId]?.tiers[entry.tier - 1]?.effects?.estateLoyalty)
    .filter(Boolean);

// Every real source of a loyalty PULL away from the 50 equilibrium: privileges granted (a permanent
// floor-raise while held), government reforms, laws, ruler traits, and owned great projects — each
// may target one named estate or `all` of them (see government.js's header comment on the raw
// `estateLoyalty` key). `greatProjectEffects` is optional and pre-computed by the one real caller
// (processEstatesTurn, once per nation per turn rather than once per estate) — every other/existing
// call site keeps working unchanged without it.
export const getEstateLoyaltyTarget = (nation, estateId, greatProjectEffects = []) => {
  let target = ESTATE_LOYALTY_EQUILIBRIUM;
  const estate = nation?.estates?.[estateId];
  (estate?.privileges || []).forEach((privilegeId) => {
    const privilege = getPrivilege(estateId, privilegeId);
    if (privilege?.loyaltyBonus) target += privilege.loyaltyBonus;
  });
  getActiveReforms(nation).forEach((reform) => { target += sumRawEstateEffect(reform.effects?.estateLoyalty, estateId); });
  Object.entries(nation?.laws || {}).forEach(([category, lawId]) => {
    const law = getLaw(category, lawId);
    target += sumRawEstateEffect(law?.effects?.estateLoyalty, estateId);
  });
  (nation?.ruler?.traits || []).forEach((traitId) => { target += sumRawEstateEffect(TRAITS[traitId]?.effects?.estateLoyalty, estateId); });
  greatProjectEffects.forEach((effect) => { target += sumRawEstateEffect(effect, estateId); });
  return Math.max(0, Math.min(100, target));
};

// Plan §M9: "Influence... 10 + 10 x privileges + land share" plus an estate-specific term (clergy:
// Culture buildings; nobility: manpower share; burghers: trade/tax-production share). This is a
// snapshot recomputed fresh every turn, not a drifting stat like loyalty. Only the player's real
// owned-region shape is scanned (O(regions)) — AI nations get the cheap privilege-only term, the
// same "player-only real computation" trim M7/M8 already established for per-nation costs that
// would otherwise force an O(regions) scan for all ~240 AI nations every turn.
// `ownedRegions` is an optional pre-computed `Object.values(state.regions).filter(owner === nationId)`
// — processEstatesTurn computes it ONCE per nation per turn and passes it to every estate's call
// instead of each of the 3-4 estates re-scanning all of state.regions itself.
export const getEstateInfluence = (state, nationId, estateId, ownedRegions = null) => {
  const nation = state.nations?.[nationId];
  const estate = nation?.estates?.[estateId];
  if (!estate) return 0;
  let influence = 10 + 10 * estate.privileges.length;
  getActiveReforms(nation).forEach((reform) => { influence += sumRawEstateEffect(reform.effects?.estateInfluence, estateId); });
  Object.entries(nation?.laws || {}).forEach(([category, lawId]) => {
    influence += sumRawEstateEffect(getLaw(category, lawId)?.effects?.estateInfluence, estateId);
  });
  if (nationId !== state.playerNationId) return Math.max(0, Math.min(100, influence));

  const regions = ownedRegions || Object.values(state.regions || {}).filter((r) => r.owner === nationId);
  influence += Math.min(30, regions.length); // land share, capped so a sprawling empire doesn't dominate influence unboundedly

  if (estateId === 'clergy') {
    const cultureBuildings = regions.filter((r) => (r.buildings?.categories?.culture ?? -1) >= 0).length;
    influence += Math.min(30, cultureBuildings * 2);
  } else if (estateId === 'nobility') {
    const manpowerDev = regions.reduce((sum, r) => sum + (r.dev?.manpower || 0), 0);
    influence += Math.min(30, Math.round(manpowerDev / 10));
  } else if (estateId === 'burghers') {
    const tradeDev = regions.reduce((sum, r) => sum + (r.dev?.tax || 0) + (r.dev?.production || 0), 0);
    influence += Math.min(30, Math.round(tradeDev / 10));
  }
  return Math.max(0, Math.min(100, influence));
};

// Runs once per nation per turn: loyalty steps 1/turn toward its target (never jumps), influence is
// recomputed fresh. Returns the SAME `estates` reference when nothing actually changed, matching
// nationalPower.js/succession.js's no-op-safe shape for resolveTurn's dirty-checking.
export const processEstatesTurn = (state, nationId) => {
  const nation = state.nations?.[nationId];
  if (!nation?.estates) return nation?.estates;
  const ownedRegions = nationId === state.playerNationId
    ? Object.values(state.regions || {}).filter((r) => r.owner === nationId)
    : null;
  const greatProjectEffects = getOwnedGreatProjectEstateLoyaltyEffects(state, nationId);
  let changed = false;
  const estates = {};
  Object.entries(nation.estates).forEach(([id, estate]) => {
    const target = getEstateLoyaltyTarget(nation, id, greatProjectEffects);
    const diff = target - estate.loyalty;
    const step = Math.sign(diff) * Math.min(1, Math.abs(diff));
    const loyalty = Math.max(0, Math.min(100, estate.loyalty + step));
    const influence = getEstateInfluence(state, nationId, id, ownedRegions);
    if (loyalty !== estate.loyalty || influence !== estate.influence) {
      changed = true;
      estates[id] = { ...estate, loyalty, influence };
    } else {
      estates[id] = estate;
    }
  });
  return changed ? estates : nation.estates;
};

export const canDoEstateInteraction = (nation, key, turnNumber) => (turnNumber || 0) >= (nation?.estateInteractionCooldowns?.[key] || 0);
