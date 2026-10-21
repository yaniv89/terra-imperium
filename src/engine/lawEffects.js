// src/engine/lawEffects.js
// The real effects of a law, worded from the same data the engine applies (playtest audit CB12,
// I142). A law's `effects` are modifier lines the modifier sheet sums (modifiers/sources.js through
// LEGACY_HOOK) and its `rules` are the hooks the tile systems read (lawRules.js). Wording them
// from those two objects, not from the hand-written `description`, means the card cannot claim
// something the engine does not do. `checkLawText` compares the written description with the
// data and returns every disagreement, so wrong text is reported (see lawEffects.test.js) instead
// of shown. One-shot costs the reducer applies on enacting are listed in ONE_SHOT below.
import { LAW_CATEGORIES, getRequiredTechName } from '../data/laws';
import { leansPositive, leansNegative } from '../data/identity';
import { getResearched } from './nationState';
import { canEnactLaws, AUTHORITY_NO_LAWS } from './authority';
import { LEGACY_HOOK } from './modifiers/registry';
import { LAW_RULE_KEYS } from './lawRules';

const pct = (v) => Math.round(v * 100);
const sgn = (v) => (v > 0 ? '+' : '-');

// effect key -> wording of a value. stabilityBonus is "unrest" in the player's terms (positive
// reduces unrest); gold is "income" because goldMult scales the nation's gold income.
const EFFECT_TEXT = {
  goldMult: (v) => `${sgn(v)}${Math.abs(pct(v))}% gold income`,
  hrMult: (v) => `${sgn(v)}${Math.abs(pct(v))}% manpower`,
  stabilityBonus: (v) => `${v > 0 ? '-' : '+'}${Math.abs(v)} unrest`,
  stabilityCost: (v) => `${sgn(v)}${Math.abs(pct(v))}% stability cost`,
  popGrowthBonus: (v) => `${sgn(v)}${Math.abs(Math.round(v * 1000) / 10)}% population growth`,
  moraleRecovery: (v) => `morale recovers ${Math.abs(pct(v))}% ${v > 0 ? 'faster' : 'slower'}`,
  opinion: (v) => `${sgn(v)}${Math.abs(v)} opinion with every nation`,
  decreePace: () => 'decrees come faster'
};
const RULE_TEXT = {
  loyaltyBonus: (v) => `${sgn(v)}${Math.abs(v)} loyalty in every city`,
  tolerance: () => 'no loyalty penalty for cities of a foreign culture',
  unitUpkeepMult: (v) => `army upkeep ${sgn(v)}${Math.abs(pct(v))}%`,
  warExhaustionMult: (v) => `war exhaustion rises ${Math.abs(pct(v))}% ${v < 0 ? 'slower' : 'faster'}`,
  tradeGoldPerRoute: (v) => `${sgn(v)}${Math.abs(v)} gold per trade pact`,
  partnerOpinion: (v) => `trade partners ${v > 0 ? '+' : '-'}${Math.abs(v)} opinion`,
  pillageGoldMult: (v) => `raids yield ${sgn(v)}${Math.abs(pct(v))}% gold`
};
/** One-shot effects of enacting, applied by gameReducer's CHANGE_LAW (not part of `effects`). */
export const ONE_SHOT = {
  martial_law: ['-1 stability when enacted'],
  collectivization: ['+2 unrest for 10 turns after enacting']
};

/** The effect lines of a law, from its data: [{ key, source: 'effect'|'rule'|'oneShot', text }]. */
export const lawEffectLines = (law) => {
  const out = [];
  Object.entries(law?.effects || {}).forEach(([key, v]) => { if (v && EFFECT_TEXT[key]) out.push({ key, source: 'effect', text: EFFECT_TEXT[key](v) }); });
  Object.entries(law?.rules || {}).forEach(([key, v]) => { if (v && RULE_TEXT[key]) out.push({ key, source: 'rule', text: RULE_TEXT[key](v) }); });
  (ONE_SHOT[law?.id] || []).forEach((text) => out.push({ key: 'oneShot', source: 'oneShot', text }));
  return out;
};

/** Does the engine have a place that applies every effect and rule key of this law? Returns the keys that nothing reads. */
export const unappliedKeys = (law) => [
  ...Object.keys(law?.effects || {}).filter((k) => !LEGACY_HOOK[k]),
  ...Object.keys(law?.rules || {}).filter((k) => !LAW_RULE_KEYS.includes(k))
];

/** Why a law cannot be enacted right now, in plain words, or null when it can (I142). */
export const lawLockReason = (state, nationId, category, law) => {
  const nation = state.nations?.[nationId];
  if (!nation || !law) return null;
  if (law.requiresTech && !getResearched(state, nationId).includes(law.requiresTech)) return `Needs ${getRequiredTechName(law) || law.requiresTech}`;
  if (law.requiresIdentity) {
    const ok = law.requiresIdentity.pole === 'negative' ? leansNegative(nation.identity, law.requiresIdentity.axis) : leansPositive(nation.identity, law.requiresIdentity.axis);
    if (!ok) return `Needs a ${law.requiresIdentity.pole === 'negative' ? 'less' : 'more'} ${law.requiresIdentity.axis} people`;
  }
  if (!canEnactLaws(state, nationId)) return `Authority is under ${AUTHORITY_NO_LAWS}: restore stability first`;
  const until = nation.lawCooldowns?.[category] || 0;
  if ((state.turnNumber || 0) < until) return `Changed recently: wait ${until - (state.turnNumber || 0)} more turn${until - (state.turnNumber || 0) === 1 ? '' : 's'}`;
  return null;
};

const numbersIn = (text) => (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);

/**
 * Compare a law's written description with its data. A number in the data (a percentage, a flat
 * amount) must appear in the description. Returns [{ lawId, category, missing: [numbers], text }]
 * for each law whose description lacks a number the data applies, or whose data claims a different
 * kind of thing ("production" for a gold multiplier).
 */
export const checkLawText = () => {
  const problems = [];
  Object.entries(LAW_CATEGORIES).forEach(([category, laws]) => laws.forEach((law) => {
    const wanted = lawEffectLines(law).filter((l) => l.source !== 'oneShot').flatMap((l) => numbersIn(l.text));
    const have = numbersIn(law.description || '');
    const missing = wanted.filter((n) => !have.includes(n));
    // The wording of a gold multiplier must say gold, tax or income; "production" is a different system.
    const wrongWord = law.effects?.goldMult && /production/i.test(law.description || '') ? ['says production, data is a gold multiplier'] : [];
    if (missing.length || wrongWord.length) problems.push({ lawId: law.id, category, missing, wrongWord, text: law.description });
  }));
  return problems;
};
