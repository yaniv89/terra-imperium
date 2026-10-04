// src/components/map/nationSheetModel.js
// The nation sheet (plans/civ-map-rework.md E4): tap a foreign owner's name on a region card and
// see the nation at a glance (its government and ruler, cities and capital, strength against
// yours, wonders), your standing with it (opinion with reasons, war, truce, pact, trade, open
// borders, vassalage, claims) and then the same actions the Diplomacy tab offers (NationCard).
import { GOVERNMENT_TYPES } from '../../data/government';
import { getNationCapital, getOwnedRegionIds } from '../../data/regions';
import { opinionOf, opinionReasons } from '../../engine/opinion';
import { isInTruce, isWarBetween } from '../../engine/diplomacy';
import { hasOpenBorders } from '../../engine/accords';
import { claimsAgainst } from '../../engine/claims';
import { getEffectiveMilitaryPower } from '../../engine/aiEconomy';
import { getGreatProjectOwner, GREAT_PROJECTS } from '../../data/greatProjects';
import { warContagionMult } from '../../engine/warContagion';

export const nationSheetModel = (state, nationId) => {
  const nation = state.nations?.[nationId];
  if (!nation || nationId === state.playerNationId) return null;
  const me = state.playerNationId;
  const cities = getOwnedRegionIds(state.regions, nationId);
  const capitalId = nation.capitalRegionId || getNationCapital(nationId);
  const mine = Math.max(1, getEffectiveMilitaryPower(state, me));
  const theirs = getEffectiveMilitaryPower(state, nationId);
  const ratio = theirs / mine;
  const war = (state.wars || []).find((w) => w.active && isWarBetween(w, me, nationId));
  const relations = [];
  if (war) relations.push({ id: 'war', label: 'At war with you', tone: 'bad' });
  if (!war && isInTruce(state, me, nationId)) relations.push({ id: 'truce', label: `Truce until turn ${state.nations[me]?.truces?.[nationId]}`, tone: 'neutral' });
  if (nation.hasMilitaryPact) relations.push({ id: 'alliance', label: 'Your ally', tone: 'good' });
  if (nation.hasTradeAgreement) relations.push({ id: 'trade', label: 'Trade pact', tone: 'good' });
  if (hasOpenBorders(state, me, nationId)) relations.push({ id: 'openBorders', label: 'Open borders', tone: 'good' });
  if (nation.vassalOf === me) relations.push({ id: 'vassal', label: 'Your vassal', tone: 'good' });
  if (state.nations[me]?.vassalOf === nationId) relations.push({ id: 'overlord', label: 'Your overlord', tone: 'neutral' });
  if ((state.nations[me]?.rivals || []).includes(nationId)) relations.push({ id: 'rival', label: 'Your rival', tone: 'bad' });
  // War contagion (warContagion.js): recent wars near this nation make it readier for its own.
  const heatPct = Math.round((warContagionMult(nation) - 1) * 100);
  if (heatPct >= 10) relations.push({ id: 'restless', label: `Wars nearby: +${heatPct}% war chance`, tone: 'bad' });
  const myClaims = claimsAgainst(state, me, nationId);
  const theirClaims = claimsAgainst(state, nationId, me);
  const wonders = Object.keys(state.greatProjects || {}).filter((id) => getGreatProjectOwner(state, id) === nationId).map((id) => GREAT_PROJECTS[id]?.name || id);
  return {
    nationId, name: nation.name, eliminated: !!nation.isEliminated,
    government: GOVERNMENT_TYPES[nation.government?.type]?.name || 'Tribal Council',
    ruler: nation.ruler?.name || null,
    cities: cities.length, capital: capitalId ? state.regions[capitalId]?.name || null : null, capitalId: capitalId || null,
    strength: { theirs: Math.round(theirs), mine: Math.round(mine), ratio: Math.round(ratio * 100) / 100, word: ratio >= 1.5 ? 'far stronger than you' : ratio >= 1.1 ? 'stronger than you' : ratio > 0.9 ? 'about your match' : ratio > 0.5 ? 'weaker than you' : 'far weaker than you' },
    opinion: opinionOf(state, nationId), reasons: opinionReasons(state, nationId).filter((r) => r.value),
    relations,
    claims: { mine: myClaims.length, theirs: theirClaims.length },
    wonders
  };
};
