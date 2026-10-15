// src/components/map/nationSheetModel.js
// The nation sheet (plans/civ-map-rework.md E4): tap a foreign owner's name on a region card and
// see the nation at a glance (its government and ruler, cities and capital, strength against
// yours, wonders), your standing with it (opinion with reasons, war, truce, pact, trade, open
// borders, vassalage, claims) and then the same actions the Diplomacy tab offers (NationCard).
import { wonderName, governmentName } from '../../i18n/gameText';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { msgRefText } from '../battle/battleText';
import { GOVERNMENT_TYPES } from '../../data/government';
import { getNationCapital, getOwnedRegionIds } from '../../data/regions';
import { opinionOf, opinionReasons } from '../../engine/opinion';
import { isInTruce, isWarBetween } from '../../engine/diplomacy';
import { hasOpenBorders } from '../../engine/accords';
import { claimsAgainst } from '../../engine/claims';
import { getEffectiveMilitaryPower } from '../../engine/aiEconomy';
import { getGreatProjectOwner, GREAT_PROJECTS } from '../../data/greatProjects';
import { warContagionMult } from '../../engine/warContagion';
import { hasMet } from '../../engine/fog';
import { tradeRouteStatus } from '../../engine/tradeDisruptions';

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
  if (war) relations.push({ id: 'war', label: t('ns.rel.war'), tone: 'bad' });
  if (!war && isInTruce(state, me, nationId)) relations.push({ id: 'truce', label: t('ns.rel.truce', { n: state.nations[me]?.truces?.[nationId] }), tone: 'neutral' });
  if (nation.hasMilitaryPact) relations.push({ id: 'alliance', label: t('ns.rel.ally'), tone: 'good' });
  // The trade pact says when it pays nothing, and why (tradeDisruptions.js tradeRouteStatus; I113, I114).
  if (nation.hasTradeAgreement) { const trade = tradeRouteStatus(state, nationId); relations.push(trade && !trade.pays ? { id: 'trade', label: trade.phase === 'cut' ? t('ns.rel.tradeCut') : t('ns.rel.tradeNothing'), tone: 'bad', detail: msgRefText(trade.textMsg, trade.text), tile: trade.tile } : { id: 'trade', label: t('ns.rel.trade'), tone: 'good', detail: trade ? msgRefText(trade.textMsg, trade.text) : null }); }
  if (hasOpenBorders(state, me, nationId)) relations.push({ id: 'openBorders', label: t('ns.rel.openBorders'), tone: 'good' });
  if (nation.vassalOf === me) relations.push({ id: 'vassal', label: t('ns.rel.vassal'), tone: 'good' });
  if (state.nations[me]?.vassalOf === nationId) relations.push({ id: 'overlord', label: t('ns.rel.overlord'), tone: 'neutral' });
  if ((state.nations[me]?.rivals || []).includes(nationId)) relations.push({ id: 'rival', label: t('ns.rel.rival'), tone: 'bad' });
  // War contagion (warContagion.js): recent wars near this nation make it readier for its own.
  const heatPct = Math.round((warContagionMult(nation) - 1) * 100);
  if (heatPct >= 10) relations.push({ id: 'restless', label: t('ns.rel.restless', { n: heatPct }), tone: 'bad' });
  const myClaims = claimsAgainst(state, me, nationId);
  const theirClaims = claimsAgainst(state, nationId, me);
  const wonders = Object.keys(state.greatProjects || {}).filter((id) => getGreatProjectOwner(state, id) === nationId).map((id) => wonderName(id, GREAT_PROJECTS[id]?.name));
  return {
    nationId, name: nameNow('people', nationId, nation.name), eliminated: !!nation.isEliminated,
    met: hasMet(state, me, nationId) || !!war, // contact needs sight (engine/fog.js); a war is contact enough
    government: governmentName(nation.government?.type || 'tribal', GOVERNMENT_TYPES[nation.government?.type]?.name || 'Tribal Council'),
    ruler: nation.ruler?.name ? nameNow('person', null, nation.ruler.name) : null,
    cities: cities.length, capital: capitalId && state.regions[capitalId]?.name ? nameNow('city', null, state.regions[capitalId].name) : null, capitalId: capitalId || null,
    strength: { theirs: Math.round(theirs), mine: Math.round(mine), ratio: Math.round(ratio * 100) / 100, word: t(ratio >= 1.5 ? 'ns.str.far' : ratio >= 1.1 ? 'ns.str.stronger' : ratio > 0.9 ? 'ns.str.match' : ratio > 0.5 ? 'ns.str.weaker' : 'ns.str.farWeaker') },
    opinion: opinionOf(state, nationId), reasons: opinionReasons(state, nationId).filter((r) => r.value),
    relations,
    claims: { mine: myClaims.length, theirs: theirClaims.length },
    wonders
  };
};
