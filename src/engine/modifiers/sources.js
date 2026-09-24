// src/engine/modifiers/sources.js
// Plan §M1: each function returns modifier LINES (never a summed total) so src/engine/modifiers/
// sheet.js can group and total them generically. `staticSources` depends only on the nation object
// itself — same reference in, same lines out — which is what makes it safe for sheet.js to cache
// per nation object rather than per (state, nationId) pair. `contextSources` depends on the wider
// state (tax rate, satellites, tech) and is NOT cached, since those can change without the nation
// object itself changing reference.
import { GOVERNMENT_TYPES } from '../../data/government';
import { POLICIES } from '../../data/policies';
import { WONDERS } from '../../data/wonders';
import { getIdentityBonus } from '../../data/identity';
import { TAX_RATES } from '../../data/taxRates';
import { getSatelliteEffectTotal } from '../../data/satellites';
import { TECH_TREE } from '../../data/techTree';
import { TechCategories } from '../../data/types';
import { LEGACY_HOOK } from './registry';

const linesFromEffect = (effect, sourceType, sourceId, label) =>
  Object.entries(effect || {})
    .filter(([hook, value]) => LEGACY_HOOK[hook] && value)
    .map(([hook, value]) => ({ key: LEGACY_HOOK[hook], value, sourceType, sourceId, label }));

export const staticSources = (nation) => {
  const lines = [];

  const gov = GOVERNMENT_TYPES[nation?.government];
  if (gov) lines.push(...linesFromEffect(gov.effect, 'government', gov.id, gov.name));

  (nation?.policies || []).forEach((id) => {
    const policy = POLICIES[id];
    if (policy) lines.push(...linesFromEffect(policy.effect, 'policy', id, policy.name));
  });

  (nation?.wonders || []).forEach((id) => {
    const wonder = WONDERS[id];
    if (wonder) lines.push(...linesFromEffect(wonder.effect, 'wonder', id, wonder.name));
  });

  Object.keys(LEGACY_HOOK).forEach((hook) => {
    const value = getIdentityBonus(nation?.identity, hook);
    if (value) lines.push({ key: LEGACY_HOOK[hook], value, sourceType: 'identity', sourceId: 'identity', label: 'National Identity' });
  });

  // Timed modifiers (plan §A.2) — nation.modifiers[] entries added by a future milestone's event/
  // disaster/law effect. Nothing populates this array yet, so this is currently always a no-op;
  // it's here so M4/M9/M13/M17 only ever need to push an entry, never touch this file again.
  (nation?.modifiers || []).forEach((mod) => {
    Object.entries(mod.mods || {}).forEach(([key, value]) => {
      if (value) lines.push({ key, value, sourceType: mod.sourceType || 'event', sourceId: mod.sourceId || mod.id, label: mod.label });
    });
  });

  return lines;
};

export const contextSources = (state, nationId) => {
  const nation = state.nations?.[nationId];
  const lines = [];

  const taxGoldMult = TAX_RATES[nation?.taxRate]?.goldMult || 0;
  if (taxGoldMult) lines.push({ key: 'national.goldMult', value: taxGoldMult, sourceType: 'tax', sourceId: nation?.taxRate, label: 'Tax Rate' });

  const satellites = state.satellites || {};
  ['goldMult', 'hrMult'].forEach((hook) => {
    const value = getSatelliteEffectTotal(satellites, nationId, hook, state.orbitalDebrisLevel);
    if (value) lines.push({ key: LEGACY_HOOK[hook], value, sourceType: 'satellite', sourceId: 'satellites', label: 'Satellites' });
  });

  // Governance techs -> Administrative Capacity (helpers.js's getMaxActionPoints, pre-engine).
  // Only the player tracks a per-tech techTree today (AI nations don't independently research —
  // see src/engine/nationState.js once M0.2's AI research support lands in a later milestone), so
  // this line only ever appears for state.playerNationId.
  if (nationId === state.playerNationId) {
    const governanceTechsResearched = Object.values(state.techTree || {})
      .filter((t) => t.researched && TECH_TREE[t.id]?.category === TechCategories.GOVERNANCE)
      .length;
    const techBonus = Math.floor(governanceTechsResearched / 3);
    if (techBonus) lines.push({ key: 'national.apBonus', value: techBonus, sourceType: 'tech', sourceId: 'governance', label: 'Governance Techs' });
  }

  return lines;
};
