// src/components/panels/empireText.js
// Words for the empire screens that the engine writes in English: the authority parts, an advisor's
// price line, what a law does, why a law is locked, the rules in force and the government change
// card. The engine keeps its English strings (tests read them); these read the same numbers and
// write them in the current language. English output is exactly the engine's text.
import { t as tNow, isolateLtr, getLanguage, ageName } from '../../i18n';
import { nameNow } from '../../i18n/names';
import { techName } from '../../i18n/gameText';
import { getAdvisorHireCost, getAdvisorSalary, ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED } from '../../engine/rulers';
import { getResearched } from '../../engine/nationState';
import { canEnactLaws, AUTHORITY_NO_LAWS } from '../../engine/authority';
import { leansPositive, leansNegative } from '../../data/identity';
import { TECH_TREE } from '../../data/techTree';
import { AGES } from '../../data/ages';
import { getCostString } from '../../utils/helpers';

/** ADM / DIP / MIL in the current language (the shell table's res.adm, res.dip, res.mil). */
export const poolLabel = (pool) => tNow(`res.${pool}`);

/** A sign and a number that stays left to right inside Hebrew text. */
const ltr = (text) => isolateLtr(text);
const sgn = (v) => (v > 0 ? '+' : '-');
const pct = (v) => Math.round(v * 100);

/** The short name of an age: "Bronze" in English; Hebrew reads the full age name. */
export const ageShort = (ageId) => (getLanguage() === 'he'
  ? ageName(ageId, AGES[ageId]?.name)
  : (AGES[ageId]?.name || ageId || '').replace(/^Age of (the )?/i, '').replace(/ Age$/i, ''));

/** One part of the authority sum (authority.js parts: id, label, value) in the current language. */
export const authorityPartLabel = (part, nation) => {
  const key = { base: 'p1.auth.base', stability: 'p1.auth.stability', legitimacy: 'p1.auth.legitimacy', laws: 'p1.auth.laws', warExhaustion: 'p1.auth.warExhaustion', overextension: 'p1.auth.overextension', capital: 'p1.auth.capital' }[part.id];
  if (part.id === 'ruler') return tNow('p1.auth.ruler', { name: nameNow('person', null, nation?.ruler?.name || '') });
  return key ? tNow(key) : part.label;
};

/** "+3 ADM a turn for 450 gold now ..." (engine/rulers.js advisorQuoteText). */
export const advisorQuote = (level, pool, current = null) => {
  const p = poolLabel(pool);
  const quote = tNow('p1.adv.quote', { level, pool: p, cost: getAdvisorHireCost(level), salary: getAdvisorSalary(level), k: ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED });
  const replaces = current ? tNow('p1.adv.replaces', { name: nameNow('person', null, current.name), level: current.level, pool: p }) : '';
  return quote + replaces;
};

// effect key -> wording of a value (lawEffects.js EFFECT_TEXT / RULE_TEXT).
const EFFECT = {
  goldMult: (v) => tNow('p1.law.goldMult', { a: ltr(`${sgn(v)}${Math.abs(pct(v))}%`) }),
  hrMult: (v) => tNow('p1.law.hrMult', { a: ltr(`${sgn(v)}${Math.abs(pct(v))}%`) }),
  stabilityBonus: (v) => tNow('p1.law.unrest', { a: ltr(`${v > 0 ? '-' : '+'}${Math.abs(v)}`) }),
  stabilityCost: (v) => tNow('p1.law.stabilityCost', { a: ltr(`${sgn(v)}${Math.abs(pct(v))}%`) }),
  popGrowthBonus: (v) => tNow('p1.law.popGrowth', { a: ltr(`${sgn(v)}${Math.abs(Math.round(v * 1000) / 10)}%`) }),
  moraleRecovery: (v) => tNow(v > 0 ? 'p1.law.moraleFaster' : 'p1.law.moraleSlower', { n: Math.abs(pct(v)) }),
  opinion: (v) => tNow('p1.law.opinion', { a: ltr(`${sgn(v)}${Math.abs(v)}`) }),
  decreePace: () => tNow('p1.law.decreePace')
};
const RULE = {
  loyaltyBonus: (v) => tNow('p1.law.loyalty', { a: ltr(`${sgn(v)}${Math.abs(v)}`) }),
  tolerance: () => tNow('p1.law.tolerance'),
  unitUpkeepMult: (v) => tNow('p1.law.upkeep', { a: ltr(`${sgn(v)}${Math.abs(pct(v))}%`) }),
  warExhaustionMult: (v) => tNow(v < 0 ? 'p1.law.exhaustSlower' : 'p1.law.exhaustFaster', { n: Math.abs(pct(v)) }),
  tradeGoldPerRoute: (v) => tNow('p1.law.perPact', { a: ltr(`${sgn(v)}${Math.abs(v)}`) }),
  partnerOpinion: (v) => tNow('p1.law.partners', { a: ltr(`${sgn(v)}${Math.abs(v)}`) }),
  pillageGoldMult: (v) => tNow('p1.law.raids', { a: ltr(`${sgn(v)}${Math.abs(pct(v))}%`) })
};

/** The effect lines of a law joined with "; " (lawEffects.js lawEffectLines, in the current language). */
export const lawEffectText = (law) => {
  const out = [];
  Object.entries(law?.effects || {}).forEach(([key, v]) => { if (v && EFFECT[key]) out.push(EFFECT[key](v)); });
  Object.entries(law?.rules || {}).forEach(([key, v]) => { if (v && RULE[key]) out.push(RULE[key](v)); });
  if (law?.id === 'martial_law') out.push(tNow('p1.law.oneShot.martial_law'));
  if (law?.id === 'collectivization') out.push(tNow('p1.law.oneShot.collectivization'));
  return out.join('; ');
};

/** Why a law cannot be enacted right now, or null (lawEffects.js lawLockReason, in the current language). */
export const lawLockText = (state, nationId, category, law) => {
  const nation = state.nations?.[nationId];
  if (!nation || !law) return null;
  if (law.requiresTech && !getResearched(state, nationId).includes(law.requiresTech)) return tNow('p1.law.needsTech', { tech: techName(law.requiresTech, TECH_TREE[law.requiresTech]?.name || law.requiresTech) });
  if (law.requiresIdentity) {
    const ok = law.requiresIdentity.pole === 'negative' ? leansNegative(nation.identity, law.requiresIdentity.axis) : leansPositive(nation.identity, law.requiresIdentity.axis);
    if (!ok) return tNow(law.requiresIdentity.pole === 'negative' ? 'p1.law.needsLess' : 'p1.law.needsMore', { axis: tNow(`p1.axis.${law.requiresIdentity.axis}`) });
  }
  if (!canEnactLaws(state, nationId)) return tNow('p1.law.needsAuthority', { n: AUTHORITY_NO_LAWS });
  const until = nation.lawCooldowns?.[category] || 0;
  if ((state.turnNumber || 0) < until) return tNow('p1.law.cooldown', { count: until - (state.turnNumber || 0) });
  return null;
};

/** One line per rule in force (lawRules.js describeRules, in the current language). */
export const describeRulesText = (rules) => {
  const out = [];
  const plus = (v) => (v > 0 ? '+' : '');
  if (rules.loyaltyBonus) out.push(tNow('p1.law.loyalty', { a: ltr(`${plus(rules.loyaltyBonus)}${rules.loyaltyBonus}`) }));
  if (rules.tolerance) out.push(tNow('p1.rules.tolerance'));
  if (rules.unitUpkeepMult) out.push(tNow('p1.law.upkeep', { a: ltr(`${plus(rules.unitUpkeepMult)}${Math.round(rules.unitUpkeepMult * 100)}%`) }));
  if (rules.warExhaustionMult) out.push(tNow('p1.rules.exhaustion', { a: ltr(`${plus(rules.warExhaustionMult)}${Math.round(rules.warExhaustionMult * 100)}%`) }));
  if (rules.tradeGoldPerRoute) out.push(tNow('p1.law.perPact', { a: ltr(`${plus(rules.tradeGoldPerRoute)}${rules.tradeGoldPerRoute}`) }));
  if (rules.partnerOpinion) out.push(tNow('p1.rules.partners', { a: ltr(`${plus(rules.partnerOpinion)}${rules.partnerOpinion}`) }));
  if (rules.pillageGoldMult) out.push(tNow('p1.law.raids', { a: ltr(`${plus(rules.pillageGoldMult)}${Math.round(rules.pillageGoldMult * 100)}%`) }));
  return out;
};

/** The Stability / Authority lines of a government change preview, joined with a space (governmentPreview.js lines). */
export const governmentCardLines = (preview) => {
  const lines = [];
  if (preview.stabilityChange) lines.push(tNow('p1.gov.stabilityLine', { a: ltr(`${preview.stabilityChange > 0 ? '+' : ''}${preview.stabilityChange}`), to: ltr(String(preview.after.stability)) }));
  if (preview.authorityChange) lines.push(tNow('p1.gov.authorityLine', { from: preview.before.authority, to: preview.after.authority }));
  if (preview.locksLaws) lines.push(tNow('p1.gov.locksLine', { n: AUTHORITY_NO_LAWS }));
  else if (!preview.after.canEnactLaws) lines.push(tNow('p1.gov.staysLine', { n: AUTHORITY_NO_LAWS }));
  return lines.join(' ');
};

/** A cost object as "2 decrees, 5 Gold" in the current language (the dialog and cards). */
export const costLine = (cost) => getCostString(cost || {});

/** What is missing for `cost`, as "2 decrees (have 1), 150 Gold (have 90)": the one shortfall line for every button.
 * `wallet` is walletOf(state): resources plus the ruler's decrees. */
export const shortfallLine = (wallet, cost) => Object.entries(cost || {})
  .filter(([key, amount]) => amount > 0 && (wallet[key] || 0) < amount)
  .map(([key, amount]) => tNow('nc.shortfallItem', { cost: getCostString({ [key]: amount }), have: Math.floor(wallet[key] || 0) }))
  .join(', ');
