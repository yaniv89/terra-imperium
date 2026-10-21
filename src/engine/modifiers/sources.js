import { tradeRoutesValue } from '../tradeValue';
// src/engine/modifiers/sources.js
// Plan §M1: each function returns modifier LINES (never a summed total) so src/engine/modifiers/
// sheet.js can group and total them generically. `staticSources` depends only on the nation object
// itself — same reference in, same lines out — which is what makes it safe for sheet.js to cache
// per nation object rather than per (state, nationId) pair. `contextSources` depends on the wider
// state (tax rate, trade, tech) and is NOT cached, since those can change without the nation
// object itself changing reference.
import { getActiveReforms } from '../../data/government';
import { LAW_CATEGORIES, getLaw } from '../../data/laws';
import { GREAT_PROJECTS, getGreatProjectOwner } from '../../data/greatProjects';
import { TAX_RATES } from '../../data/taxRates';
import { TECH_TREE } from '../../data/techTree';
import { LEGACY_HOOK } from './registry';
import { getOverextension } from '../nationalPower';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { VIRTUES } from '../../data/rulerVirtues';

const ADVISOR_JOBS = { adm: { key: 'national.decreePace', per: 1 }, dip: { key: 'national.opinion', per: 5 }, mil: { key: 'national.hrMult', per: 0.05 } };

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

  // Timed modifiers (plan §A.2) — nation.modifiers[] entries added by a future milestone's event/
  // disaster/law effect. Nothing populates this array yet, so this is currently always a no-op;
  // it's here so M4/M9/M13/M17 only ever need to push an entry, never touch this file again.
  (nation?.modifiers || []).forEach((mod) => {
    Object.entries(mod.mods || {}).forEach(([key, value]) => {
      if (value) lines.push({ key, value, sourceType: mod.sourceType || 'event', sourceId: mod.sourceId || mod.id, label: mod.label });
    });
  });

  // The ruler: Military above 3 +2% manpower a level, Command +5% morale recovery a level and the
  // Virtue tree (RULER-PLAN 3; Administration works in src/engine/decrees.js, Diplomacy in opinion.js).
  const ruler = nation?.ruler;
  if (ruler) {
    if ((ruler.mil || 0) > 3) lines.push({ key: 'national.hrMult', value: Math.round(2 * (ruler.mil - 3)) / 100, sourceType: 'ruler', sourceId: ruler.id, label: `${ruler.name} (Military ${ruler.mil})` });
    if (ruler.cmd) lines.push({ key: 'national.moraleRecovery', value: Math.round(5 * ruler.cmd) / 100, sourceType: 'ruler', sourceId: ruler.id, label: `${ruler.name} (Command ${ruler.cmd})` });
    (ruler.traits || []).forEach((id) => { if (VIRTUES[id]) lines.push(...linesFromEffect(VIRTUES[id].effects, 'virtue', id, `${ruler.name} (${VIRTUES[id].name})`)); });
  }

  // An advisor's level feeds its slot's new job (differentiation plan KTD5): decree pace, +5 opinion
  // or +5% manpower a level.
  Object.entries(nation?.advisors || {}).forEach(([slot, advisor]) => {
    const job = ADVISOR_JOBS[slot];
    if (advisor?.level && job) lines.push({ key: job.key, value: job.per * advisor.level, sourceType: 'advisor', sourceId: advisor.id, label: advisor.name });
  });

  return lines;
};

export const contextSources = (state, nationId) => {
  const nation = state.nations?.[nationId];
  const lines = [];

  const taxGoldMult = TAX_RATES[nation?.taxRate]?.goldMult || 0;
  if (taxGoldMult) lines.push({ key: 'national.goldMult', value: taxGoldMult, sourceType: 'tax', sourceId: nation?.taxRate, label: 'Tax Rate' });

  // Trade Pacts: one line per open route, worth the gravity model's share (tradeValue.js: both
  // economies' sizes over the route's km), which replaced the flat +5% per pact. Pacts are
  // player-centric (hasTradeAgreement lives on the OTHER nation's record; AI nations never form
  // pacts with each other), so this only ever applies to the player.
  if (nationId === state.playerNationId) {
    tradeRoutesValue(state, nationId).forEach((r) => {
      lines.push({ key: 'national.goldMult', value: r.mult, sourceType: 'tradePact', sourceId: `trade_${r.partnerId}`, label: `Trade with ${r.name} (${r.km} km)` });
    });
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

  // Plan §M7: every researched tech's own real effects (TECH_TREE[id].effects, src/data/
  // techTree.js) — this REPLACES the old flat "+1 ADM per 3 Governance techs" rule with the
  // per-tech table the plan always specified (Code of Laws/Royal Chancery/Digital Administration
  // each contribute their own decree pace). Only the player tracks a per-tech techTree today (AI
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
  // (folded onto national.goldMult, the same key tax rate already uses).
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
  // Bug fix (plan feedback: "issue with great works" — the Forbidden City's own governingCapacity
  // effect was silently a no-op): `lines` already holds this function's OWN contextSources pushes
  // by this point, including the great-project loop above — concatenating it in here, rather than
  // reading staticSources(nation) alone, is what makes a great project's governingCapacity actually
  // count, with no new import (state.greatProjects is already read earlier in this same function).
  const capacityBonus = (nation ? staticSources(nation) : [])
    .concat(lines)
    .filter((l) => l.key === 'national.governingCapacity')
    .reduce((sum, l) => sum + l.value, 0);
  const overextension = getOverextension(state, nationId, capacityBonus);
  if (overextension > 0) {
    lines.push({ key: 'national.stabilityBonus', value: -(overextension / 20), sourceType: 'overextension', sourceId: 'overextension', label: 'Overextension' });
  }

  // Legitimacy/tradition/devotion below 50 (plan §M4): +1 unrest everywhere (the old -1 to the
  // ruler's best pool is a slower decree trickle now, src/engine/decrees.js). "Extra rebel chance" is adapted onto the same unrest line rather than a separate
  // hook into src/data/rebellion.js's own threshold check.
  const legitimacy = nation?.legitimacy ?? 50;
  if (legitimacy < 50 && nation?.ruler) {
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
