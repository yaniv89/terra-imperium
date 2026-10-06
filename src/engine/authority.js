// src/engine/authority.js
// Authority (plans/civ-map-rework.md, C4.1; workstream 8). One meter, 0 to 100, with a breakdown,
// DERIVED each time from the numbers every writer already keeps (stability, legitimacy, the
// ruler, laws, war exhaustion, overextension, the capital), so no writer changes:
//   authority = AUTHORITY_BASE
//             + AUTHORITY_PER_STABILITY x stability            (-3..3)
//             + (legitimacy - 50) / AUTHORITY_LEGITIMACY_DIV    (0..100)
//             + (ruler ADM + DIP + MIL - AUTHORITY_RULER_PAR)   (skills)
//             + AUTHORITY_PER_LAW_STABILITY x the laws' stabilityBonus sum
//             - war exhaustion / AUTHORITY_WAR_EXHAUSTION_DIV
//             - overextension / AUTHORITY_OVEREXTENSION_DIV     (capped at AUTHORITY_OVEREXTENSION_MAX)
//             - AUTHORITY_CAPITAL_LOST while the capital is in other hands or occupied
// Gates: under AUTHORITY_NO_LAWS no law can be enacted (laws.js canEnactLaw); under AUTHORITY_CIVIL_WAR the turn
// counts as a low-stability turn for the civil war streak (civilWar.js). Prestige stays its own
// score. Pure.
import { LAW_CATEGORIES, getLaw } from '../data/laws';
import { getOverextension } from './nationalPower';

export const AUTHORITY_BASE = 50;
export const AUTHORITY_PER_STABILITY = 8;
export const AUTHORITY_LEGITIMACY_DIV = 2;
export const AUTHORITY_RULER_PAR = 9;
export const AUTHORITY_PER_LAW_STABILITY = 5;
export const AUTHORITY_WAR_EXHAUSTION_DIV = 4;
export const AUTHORITY_OVEREXTENSION_DIV = 4;
export const AUTHORITY_OVEREXTENSION_MAX = 25;
export const AUTHORITY_CAPITAL_LOST = 20;
export const AUTHORITY_NO_LAWS = 25;
export const AUTHORITY_CIVIL_WAR = 10;

const r1 = (v) => Math.round(v * 10) / 10;

/** The authority of a nation today: { total, parts: [{ id, label, value }] }. */
export const authorityOf = (state, nationId) => {
  const n = state.nations?.[nationId];
  if (!n) return { total: 0, parts: [] };
  const parts = [{ id: 'base', label: 'Rule', value: AUTHORITY_BASE }];
  const stability = n.stability || 0;
  if (stability) parts.push({ id: 'stability', label: 'Stability', value: AUTHORITY_PER_STABILITY * stability });
  const legitimacy = n.legitimacy ?? 50;
  if (legitimacy !== 50) parts.push({ id: 'legitimacy', label: 'Legitimacy', value: r1((legitimacy - 50) / AUTHORITY_LEGITIMACY_DIV) });
  if (n.ruler) { const skill = (n.ruler.adm || 0) + (n.ruler.dip || 0) + (n.ruler.mil || 0) - AUTHORITY_RULER_PAR; if (skill) parts.push({ id: 'ruler', label: `${n.ruler.name}'s skill`, value: skill }); }
  const lawBonus = Object.keys(LAW_CATEGORIES).reduce((s, cat) => s + (getLaw(cat, n.laws?.[cat])?.effects?.stabilityBonus || 0), 0);
  if (lawBonus) parts.push({ id: 'laws', label: 'Laws', value: AUTHORITY_PER_LAW_STABILITY * lawBonus });
  if (n.warExhaustion > 0) parts.push({ id: 'warExhaustion', label: 'War exhaustion', value: -r1(n.warExhaustion / AUTHORITY_WAR_EXHAUSTION_DIV) });
  const over = getOverextension(state, nationId);
  if (over > 0) parts.push({ id: 'overextension', label: 'Overextension', value: -Math.min(AUTHORITY_OVEREXTENSION_MAX, r1(over / AUTHORITY_OVEREXTENSION_DIV)) });
  const capital = n.capitalRegionId ? state.regions?.[n.capitalRegionId] : null;
  if (capital && (capital.owner !== nationId || (capital.occupiedBy && capital.occupiedBy !== nationId))) parts.push({ id: 'capital', label: 'Capital lost', value: -AUTHORITY_CAPITAL_LOST });
  const total = Math.max(0, Math.min(100, Math.round(parts.reduce((s, p) => s + p.value, 0))));
  return { total, parts };
};

export const canEnactLaws = (state, nationId) => authorityOf(state, nationId).total >= AUTHORITY_NO_LAWS;
export const authorityRisksCivilWar = (state, nationId) => authorityOf(state, nationId).total < AUTHORITY_CIVIL_WAR;
