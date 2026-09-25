// src/engine/modifiers/sources.js
// Plan §M1: each function returns modifier LINES (never a summed total) so src/engine/modifiers/
// sheet.js can group and total them generically. `staticSources` depends only on the nation object
// itself — same reference in, same lines out — which is what makes it safe for sheet.js to cache
// per nation object rather than per (state, nationId) pair. `contextSources` depends on the wider
// state (tax rate, satellites, tech) and is NOT cached, since those can change without the nation
// object itself changing reference.
import { getActiveReforms } from '../../data/government';
import { LAW_CATEGORIES, getLaw } from '../../data/laws';
import {
  ESTATE_LABELS, ESTATE_THRESHOLD_BONUS, ESTATE_THRESHOLD_MALUS, ESTATE_LOYALTY_HIGH_THRESHOLD,
  ESTATE_LOYALTY_LOW_THRESHOLD, getPrivilege, CROWN_LAND_LOW_THRESHOLD, CROWN_LAND_HIGH_THRESHOLD
} from '../../data/estates';
import { GREAT_PROJECTS, getGreatProjectOwner } from '../../data/greatProjects';
import { TAX_RATES } from '../../data/taxRates';
import { FUSION_GRID_GOLD_MULT_BONUS, TRADE_PACT_GOLD_MULT_PER_PACT } from '../../data/actionCosts';
import { getSatelliteEffectTotal } from '../../data/satellites';
import { TECH_TREE } from '../../data/techTree';
import { TRAITS } from '../../data/traits';
import { LEGACY_HOOK } from './registry';
import { getOverextension, getRulerBestPool } from '../nationalPower';
import { BUILDING_CATEGORIES } from '../../data/buildings';

const linesFromEffect = (effect, sourceType, sourceId, label) =>
  Object.entries(effect || {})
    .filter(([hook, value]) => LEGACY_HOOK[hook] && value)
    .map(([hook, value]) => ({ key: LEGACY_HOOK[hook], value, sourceType, sourceId, label }));

export const staticSources = (nation) => {
  const lines = [];

  // Plan §M8.1: every reform tier the nation has reached and picked contributes simultaneously
  // (see government.js's header comment on why they stack rather than replace one another) —
  // this REPLACES the old flat "one government id -> one effect object" lookup.
  getActiveReforms(nation).forEach((reform) => {
    lines.push(...linesFromEffect(reform.effects, 'government', reform.id, reform.name));
  });

  // Plan §M8.2: laws replace policies — one law per category, always present (DEFAULT_LAWS), rather
  // than a shared slot pool a government's slot count used to limit.
  Object.keys(LAW_CATEGORIES).forEach((category) => {
    const lawId = nation?.laws?.[category];
    const law = lawId && getLaw(category, lawId);
    if (law) lines.push(...linesFromEffect(law.effects, 'law', lawId, law.name));
  });

  // Plan §M8.3: identity no longer grants a flat gold/stability multiplier here — it only gates and
  // discounts government types/laws (src/data/government.js, src/data/laws.js), which read the
  // nation's identity directly rather than through a modifier line.

  // Plan §M9: each estate's loyalty threshold bonus/malus (>= 60 / < 30) and every privilege it's
  // been granted. Loyalty drift itself lives in src/engine/estates.js (it's state-dependent —
  // reforms/laws/traits move the target — so it's recomputed in resolveTurn, not here); this only
  // reads today's already-computed loyalty number off the nation.
  Object.entries(nation?.estates || {}).forEach(([estateId, estate]) => {
    if (!estate) return;
    const label = ESTATE_LABELS[estateId] || estateId;
    if (estate.loyalty >= ESTATE_LOYALTY_HIGH_THRESHOLD && ESTATE_THRESHOLD_BONUS[estateId]) {
      lines.push(...linesFromEffect(ESTATE_THRESHOLD_BONUS[estateId], 'estate', estateId, `${label} (loyal)`));
    } else if (estate.loyalty < ESTATE_LOYALTY_LOW_THRESHOLD && ESTATE_THRESHOLD_MALUS[estateId]) {
      lines.push(...linesFromEffect(ESTATE_THRESHOLD_MALUS[estateId], 'estate', estateId, `${label} (disloyal)`));
    }
    (estate.privileges || []).forEach((privilegeId) => {
      const privilege = getPrivilege(estateId, privilegeId);
      if (privilege) lines.push(...linesFromEffect(privilege.effects, 'privilege', privilegeId, privilege.name));
    });
  });

  // Crown land (plan §M9): <= 30% shrinks the tax base (a stability CAP is deferred — no floor/cap
  // pipeline on the stability number itself exists yet); >= 70% swells it at the cost of unrest.
  const crownLand = nation?.crownLand ?? 50;
  if (crownLand <= CROWN_LAND_LOW_THRESHOLD) {
    lines.push({ key: 'national.goldMult', value: -0.1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'Low Crown Land' });
  } else if (crownLand >= CROWN_LAND_HIGH_THRESHOLD) {
    lines.push({ key: 'national.goldMult', value: 0.1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'High Crown Land' });
    lines.push({ key: 'national.stabilityBonus', value: -1, sourceType: 'crownLand', sourceId: 'crownLand', label: 'High Crown Land' });
  }

  // Timed modifiers (plan §A.2) — nation.modifiers[] entries added by a future milestone's event/
  // disaster/law effect. Nothing populates this array yet, so this is currently always a no-op;
  // it's here so M4/M9/M13/M17 only ever need to push an entry, never touch this file again.
  (nation?.modifiers || []).forEach((mod) => {
    Object.entries(mod.mods || {}).forEach(([key, value]) => {
      if (value) lines.push({ key, value, sourceType: mod.sourceType || 'event', sourceId: mod.sourceId || mod.id, label: mod.label });
    });
  });

  // Plan §M3: the ruler's own ADM/DIP/MIL skill (0-6 each) feeds the matching per-pool bonus hook
  // directly — a skill of 0 contributes nothing rather than a negative, so an unskilled ruler is
  // merely unhelpful, not actively harmful (that's what the Incompetent/Sickly TRAITS are for).
  // Ruler and advisor traits reuse linesFromEffect exactly like a government/policy/wonder does.
  const ruler = nation?.ruler;
  if (ruler) {
    ['adm', 'dip', 'mil'].forEach((pool) => {
      if (ruler[pool]) lines.push({ key: `national.${pool}Bonus`, value: ruler[pool], sourceType: 'ruler', sourceId: ruler.id, label: ruler.name });
    });
    (ruler.traits || []).forEach((traitId) => {
      const trait = TRAITS[traitId];
      if (trait) lines.push(...linesFromEffect(trait.effects, 'trait', traitId, trait.name));
    });
  }

  // Advisors (plan §M3): each hired advisor's level (1-3) adds straight to their own pool, on top
  // of anything the ruler or government already contribute to it.
  Object.entries(nation?.advisors || {}).forEach(([pool, advisor]) => {
    if (advisor?.level) lines.push({ key: `national.${pool}Bonus`, value: advisor.level, sourceType: 'advisor', sourceId: advisor.id, label: advisor.name });
  });

  return lines;
};

export const contextSources = (state, nationId) => {
  const nation = state.nations?.[nationId];
  const lines = [];

  const taxGoldMult = TAX_RATES[nation?.taxRate]?.goldMult || 0;
  if (taxGoldMult) lines.push({ key: 'national.goldMult', value: taxGoldMult, sourceType: 'tax', sourceId: nation?.taxRate, label: 'Tax Rate' });

  // Fusion Grid (plan §M11 resource sink) — folds into goldMult like every other producer bonus in
  // this codebase (see actionCosts.js's FUSION_GRID_GOLD_MULT_BONUS header on the tax/production
  // split trim). resolveTurn.js deactivates fusionGridActive the turn helium3 upkeep can't be paid,
  // so reading the flag here is enough — no separate "supplied" check needed.
  if (nation?.fusionGridActive) lines.push({ key: 'national.goldMult', value: FUSION_GRID_GOLD_MULT_BONUS, sourceType: 'fusionGrid', sourceId: 'fusion_grid', label: 'Fusion Grid' });

  // Trade Pacts (plan §M12: "+5% x pact count", replacing the old flat +20 gold/partner) — pacts
  // are inherently player-centric today (hasTradeAgreement lives on the OTHER nation's own record,
  // and AI nations never form pacts with each other), so this only ever applies to the player.
  if (nationId === state.playerNationId) {
    const activePactCount = Object.values(state.nations || {}).filter((n) => n.hasTradeAgreement).length;
    if (activePactCount > 0) {
      lines.push({ key: 'national.goldMult', value: activePactCount * TRADE_PACT_GOLD_MULT_PER_PACT, sourceType: 'tradePact', sourceId: 'trade_pacts', label: 'Trade Pacts' });
    }
  }

  // Plan §M10: Great Projects. Ownership is derived from the site region's current owner
  // (getGreatProjectOwner), not stored on the nation — this is why the source has to live here in
  // contextSources rather than staticSources, unlike wonders.js's old flat `nation.wonders[]`.
  Object.entries(state.greatProjects || {}).forEach(([projectId, entry]) => {
    if (!entry?.tier || getGreatProjectOwner(state, projectId) !== nationId) return;
    const project = GREAT_PROJECTS[projectId];
    const tierEffects = project?.tiers[entry.tier - 1]?.effects;
    if (tierEffects) lines.push(...linesFromEffect(tierEffects, 'greatProject', projectId, project.name));
  });

  const satellites = state.satellites || {};
  ['goldMult', 'hrMult'].forEach((hook) => {
    const value = getSatelliteEffectTotal(satellites, nationId, hook, state.orbitalDebrisLevel);
    if (value) lines.push({ key: LEGACY_HOOK[hook], value, sourceType: 'satellite', sourceId: 'satellites', label: 'Satellites' });
  });

  // Plan §M7: every researched tech's own real effects (TECH_TREE[id].effects, src/data/
  // techTree.js) — this REPLACES the old flat "+1 ADM per 3 Governance techs" rule with the
  // per-tech table the plan always specified (Code of Laws/Royal Chancery/Digital Administration
  // each contribute their own +1 admBonus). Only the player tracks a per-tech techTree today (AI
  // nations don't independently research — see src/engine/nationState.js once M0.2's AI research
  // support lands in a later milestone), so this only ever appears for state.playerNationId.
  if (nationId === state.playerNationId) {
    Object.entries(state.techTree || {}).forEach(([techId, techState]) => {
      if (!techState.researched) return;
      const tech = TECH_TREE[techId];
      if (tech?.effects) lines.push(...linesFromEffect(tech.effects, 'tech', techId, tech.name));
    });
  }

  // National stability (plan §M4): each level shaves/adds 1 unrest everywhere (national.stabilityBonus
  // already flips sign the same way traits do, see nextUnrest's convention) and ±5% tax/production
  // (folded onto national.goldMult, the same key tax rate/satellites already use).
  const stability = nation?.stability || 0;
  if (stability) {
    lines.push({ key: 'national.stabilityBonus', value: stability, sourceType: 'stability', sourceId: 'stability', label: 'Stability' });
    lines.push({ key: 'national.goldMult', value: stability * 0.05, sourceType: 'stability', sourceId: 'stability', label: 'Stability' });
  }

  // Overextension (plan §M4): "+overextension/20 unrest in every region" — the blanket "+ADM/DIP
  // cost" half of the plan's own effect table is deferred (see nationalPower.js's own header
  // comment: no per-action modifier-aware cost pipeline exists yet to apply it generically).
  // Plan §M8.1: a reform's own national.governingCapacity line (Imperial Bureaucracy, Dutch-style
  // Federal Republic) is read straight off staticSources here — NOT via getModifier/getNationSheet
  // — so this file never calls back into itself through the sheet cache, and nationalPower.js never
  // has to import the modifier engine (see its own header comment on why that would be circular).
  const capacityBonus = nation ? staticSources(nation)
    .filter((l) => l.key === 'national.governingCapacity')
    .reduce((sum, l) => sum + l.value, 0) : 0;
  const overextension = getOverextension(state, nationId, capacityBonus);
  if (overextension > 0) {
    lines.push({ key: 'national.stabilityBonus', value: -(overextension / 20), sourceType: 'overextension', sourceId: 'overextension', label: 'Overextension' });
  }

  // Legitimacy/tradition/devotion below 50 (plan §M4): -1 to the ruler's best pool, +1 unrest
  // everywhere. "Extra rebel chance" is adapted onto the same unrest line rather than a separate
  // hook into src/data/rebellion.js's own threshold check.
  const legitimacy = nation?.legitimacy ?? 50;
  if (legitimacy < 50 && nation?.ruler) {
    const bestPool = getRulerBestPool(nation.ruler);
    lines.push({ key: `national.${bestPool}Bonus`, value: -1, sourceType: 'legitimacy', sourceId: 'legitimacy', label: 'Low Legitimacy' });
    lines.push({ key: 'national.stabilityBonus', value: -1, sourceType: 'legitimacy', sourceId: 'legitimacy', label: 'Low Legitimacy' });
  }

  return lines;
};

// Plan §M6: a region's own building tiers, feeding the local.* keys directly (these are already
// the modern key names in src/data/buildings.js's `effects` objects, not old short hook names, so
// this doesn't go through LEGACY_HOOK/linesFromEffect the way a nation source does). A region with
// no building in a category (tier -1) contributes nothing for it.
export const regionSources = (region) => {
  const lines = [];
  Object.entries(region?.buildings?.categories || {}).forEach(([categoryId, tierIndex]) => {
    if (tierIndex < 0) return;
    const tier = BUILDING_CATEGORIES[categoryId]?.tiers[tierIndex];
    if (!tier?.effects) return;
    Object.entries(tier.effects).forEach(([key, value]) => {
      lines.push({ key, value, sourceType: 'building', sourceId: `${categoryId}_${tierIndex}`, label: tier.name });
    });
  });
  return lines;
};
