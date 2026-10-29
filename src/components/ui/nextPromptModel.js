// src/components/ui/nextPromptModel.js
// The "next" prompt (plans/civ-map-rework.md E3): one pill above End Turn that cycles through what
// still wants a decision this turn. Pure: a list of prompts in order. Some of them (research, an
// idle city, a demand, a peace offer) are also End Turn's blockers (src/engine/turnBlockers.js);
// the SOFT_KINDS below never block.
//   peace     a peace offer waits for an answer
//   research  nothing is being researched and the advisor is not choosing
//   city      a city with an empty build queue
//   settler   a settler with no destination
//   army      an army in the field with moves left and nothing to do: no route, no Hold order, no
//             siege (garrisons rest in their cities); src/engine/standingOrders.js decides
//   unrest    a city whose unrest is UNREST_PROMPT or more, or one that could break away within
//             LOYALTY_PROMPT_TURNS turns (loyalty.js loyaltyForecast)
//   guide     the guided start's current step (src/engine/tutorial.js), always first
//   demand    an AI's tribute demand waits for an answer (src/engine/aiAccords.js)
//   war       a people declared war on you in the last WAR_NOTICE_TURNS turns (a notice: it never blocks
//             End Turn, stays on screen while other answers are given, and opens Peoples; I117)
//   maps      a major offers to swap maps (src/engine/mapTrade.js, I116): a notice, never a blocker
//   ruler     the ruler can raise an attribute or take a virtue now (rulers.js; playtest 22 Oct)
//   governor  a city group's seat is empty and the court has a candidate (governors.js)
//   decrees   the decree bank is full: the next deed's decree would be lost (decrees.js)
//   uprising  the Machine Uprising is coming (automation.js uprisingWarning): the turns left and how
//             to stop it; opens the domestic panel (the Raise stability decree)
//   law       a new age gave one law change for no decree (laws.js lawChangeCost)
//   crisis    a history crisis will strike the player (crises.js crisisComing): the turns left and what softens it
import { unitTile } from '../../engine/armies';
import { isSettler, isBand, settlingOutlook } from '../../engine/settlers';
import { ageOf } from '../../engine/nationState';
import { tutorialPrompt } from '../../engine/tutorial';
import { demandWaiting } from '../../engine/aiAccords';
import { researchNeedsChoice } from '../../engine/researchStatus';
import { pendingLandmarkAge } from '../../engine/ageLandmarks';
import { supplyOf, supplyZone, SUPPLY_LOW } from '../../engine/supplyMeter';
import { getTiles } from '../../data/geo/tiles';
import { idleArmyTiles } from '../../engine/standingOrders';
import { loyaltyForecast, loyaltyOf } from '../../engine/loyalty';
import { t as tNow, formatNumber } from '../../i18n';
import { crisisComing } from '../../engine/crises';
import { nameNow } from '../../i18n/names';
import { ATTRIBUTES, raiseBlock, virtueBlock } from '../../engine/rulers';
import { VIRTUES } from '../../data/rulerVirtues';
import { cityGroups, governorChoices } from '../../engine/governors';
import { decreesOf, decreeCap } from '../../engine/decrees';
import { LAW_CATEGORIES, canEnactLaw } from '../../data/laws';

const pName = (state, id) => nameNow('people', id, state.nations?.[id]?.name || '');
const cName = (c) => nameNow('city', null, c.name);

export const UNREST_PROMPT = 50;
export const LOYALTY_PROMPT_TURNS = 12; // a city that could break away within this many turns is a hint (I127)
export const WAR_NOTICE_TURNS = 3; // turns of play a declaration stays as a chip (an on-screen notice, not a span of history)
export const WARN_ARM_MS = 4000;

// The prompts that never block End Turn (the rest are End Turn's blockers, src/engine/turnBlockers.js):
// units that can still move or wait for orders, a restless city, an army low on supply.
export const SOFT_KINDS = new Set(['army', 'settler', 'unrest', 'supply', 'ruler', 'governor', 'decrees', 'uprising', 'law', 'crisis']);
/** The soft hints that still wait (the "warn me" setting's list). */
export const softHints = (state) => nextPrompts(state).filter((p) => SOFT_KINDS.has(p.kind));
/** With the "warn me" setting on: how many soft hints still wait before End Turn; 0 otherwise. */
export const endTurnWarnings = (state) => (state.battleSettings?.warnEndTurn ? softHints(state).length : 0);

export const nextPrompts = (state) => {
  const me = state.playerNationId;
  const out = [];
  const guide = tutorialPrompt(state);
  if (guide) out.push(guide);
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: tNow('prompt.peaceWaits'), tab: 'diplomacy' });
  if (demandWaiting(state)) { const d = state.pendingDemand; out.push({ id: 'demand', kind: 'demand', label: d.kind === 'city' ? tNow('prompt.demand.city', { name: pName(state, d.from), city: d.cityName ? nameNow('city', null, d.cityName) : tNow('prompt.aCity') }) : d.kind === 'stopSettling' ? tNow('prompt.demand.stop', { name: pName(state, d.from) }) : tNow('prompt.demand.gold', { name: pName(state, d.from), amount: d.amount }), tab: 'diplomacy' }); }
  // A war declared on the player lately: the log line alone was easy to miss (I117).
  (state.wars || []).forEach((w) => { if (w.active && w.enemy === me && w.aggressor && state.nations?.[w.aggressor] && (state.turnNumber || 0) - (w.startTurn ?? -Infinity) < WAR_NOTICE_TURNS) out.push({ id: 'war:' + w.id, kind: 'war', label: tNow('prompt.warOnYou', { name: pName(state, w.aggressor) }), tab: 'diplomacy', nationId: w.aggressor }); });
  // A major's offer to swap maps (mapTrade.js, I116): a notice like the war one, never a blocker.
  if (state.pendingMapOffer && state.nations?.[state.pendingMapOffer.from] && !state.nations[state.pendingMapOffer.from].isEliminated) out.push({ id: 'maps', kind: 'maps', label: tNow('prompt.mapOffer', { name: pName(state, state.pendingMapOffer.from) }), tab: 'diplomacy', nationId: state.pendingMapOffer.from });
  const warned = state.nations?.[me]?.uprisingWarning;
  if (warned) out.push({ id: 'uprising', kind: 'uprising', label: tNow('prompt.uprising', { count: Math.max(0, warned.at - (state.turnNumber || 0)) }), tab: 'domestic', section: 'court' });
  // A history crisis announced against the player (crises.js crisisComing, follow-up 25): when, and what softens it.
  const coming = crisisComing(state);
  if (coming) {
    const { crisis } = coming;
    const go = { collapse: { tab: 'domestic', section: 'court' }, war: { tab: 'diplomacy' }, plague: { tab: 'tech' } }[crisis.effect] || { regionId: state.nations?.[me]?.capitalRegionId };
    out.push({ id: 'crisis', kind: 'crisis', label: tNow('crisis.chip', { count: Math.max(1, coming.turn - (state.turnNumber || 0)), fix: tNow(`crisis.fix.${crisis.effect}`) }), ...go });
  }
  if (researchNeedsChoice(state)) out.push({ id: 'research', kind: 'research', label: tNow('prompt.research'), tab: 'tech' });
  if (pendingLandmarkAge(state)) out.push({ id: 'landmark', kind: 'landmark', label: tNow('prompt.landmark'), tab: 'tech' });
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null && !c.outpost).sort((a, b) => (a.id < b.id ? -1 : 1));
  cities.forEach((c) => { if (!c.production?.current) out.push({ id: `city:${c.id}`, kind: 'city', label: tNow('prompt.cityIdle', { city: cName(c) }), regionId: c.id }); });
  // Choices that wait in a panel (playtest 22 Oct: players missed them behind the rail's dot).
  const nation = state.nations?.[me];
  if (nation?.ruler && (ATTRIBUTES.some((a) => !raiseBlock(state, me, a)) || Object.keys(VIRTUES).some((v) => !virtueBlock(state, me, v)))) out.push({ id: 'ruler', kind: 'ruler', label: tNow('prompt.ruler'), tab: 'ruler' });
  const emptySeats = nation && cities.length ? cityGroups(state, me).filter((g) => !nation.governors?.[g.seat]).length : 0;
  if (emptySeats && governorChoices(nation).length) out.push({ id: 'governor', kind: 'governor', label: tNow('prompt.governor', { count: emptySeats }), tab: 'domestic', section: 'court.governors', count: emptySeats });
  // only when a law can be enacted now (manual playtest 29 Oct: the chip stayed with nothing to adopt)
  const lawOpen = !!nation && Object.entries(LAW_CATEGORIES).some(([cat, laws]) => laws.some((l) => canEnactLaw(state, me, cat, l.id)));
  if (nation?.freeLawChange && lawOpen) out.push({ id: 'freeLaw', kind: 'law', label: tNow('prompt.freeLaw'), tab: 'domestic', section: 'laws' });
  // full decrees go where they are spent: a law, else the Peoples tab (demands, claims, pacts); the ruler sheet spends none
  if (nation?.ruler && decreesOf(nation) >= decreeCap(nation)) out.push({ id: 'decrees', kind: 'decrees', label: tNow('prompt.decrees'), ...(lawOpen ? { tab: 'domestic', section: 'laws' } : { tab: 'diplomacy' }) });
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === me && u.strength > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  // (settlers told to wait, settlers.js setSettlerHold, are not asked about again: I093)
  // Settlers with no good site known in reach are not idle either: nothing to order but Send home, and
  // the Idle badge never cleared on a settled map (Opus playtest step 385). Bands found anywhere.
  const ageId = ageOf(state, me);
  units.forEach((u) => { if (isSettler(u) && u.target == null && u.tile != null && !u.hold && (isBand(u) || settlingOutlook(state, me, u.tile, ageId).ok)) out.push({ id: `settler:${u.id}`, kind: 'settler', label: tNow(isBand(u) ? 'prompt.band' : 'prompt.settlers'), tile: u.tile }); });
  // Idle armies (src/engine/standingOrders.js idleArmyTiles): a stack that marches, holds (the
  // Hold order), besieges a city or garrisons one is busy, not idle.
  idleArmyTiles(state, me).forEach((t) => out.push({ id: `army:${t}`, kind: 'army', label: tNow('prompt.army'), tile: t }));
  cities.forEach((c) => { if ((c.unrest || 0) >= UNREST_PROMPT) out.push({ id: `unrest:${c.id}`, kind: 'unrest', label: tNow('prompt.restless', { city: cName(c), n: formatNumber(Math.round(c.unrest)) }), regionId: c.id }); });
  // A city heading to break away (loyalty.js loyaltyForecast, I127): a hint while there is time to garrison it.
  cities.forEach((c) => {
    if ((c.unrest || 0) >= UNREST_PROMPT || (!c.conquest && loyaltyOf(c) >= 50)) return;
    const f = loyaltyForecast(state, c);
    if (f.breaksIn != null && f.breaksIn <= LOYALTY_PROMPT_TURNS) out.push({ id: `unrest:${c.id}`, kind: 'unrest', label: tNow('prompt.breaks', { city: cName(c), count: f.breaksIn }), regionId: c.id });
  });
  // An army running out of supply (supplyMeter.js): under SUPPLY_LOW and falling.
  const lowSeen = new Set();
  units.forEach((u) => {
    if (u.domain !== 'land' || u.embarkedOn || isSettler(u) || !(u.strength > 0) || u.tile == null) return;
    const t = unitTile(state, u); if (lowSeen.has(t)) return;
    const zone = supplyZone(state, getTiles(), u);
    // At an empty meter outside home land the stack starves even where the meter only holds.
    if (supplyOf(u) <= 0 && zone.zone !== 'home') { lowSeen.add(t); out.push({ id: `supply:${t}`, kind: 'supply', label: tNow('prompt.starving'), tile: t }); } else if (supplyOf(u) < SUPPLY_LOW && zone.delta < 0) { lowSeen.add(t); out.push({ id: `supply:${t}`, kind: 'supply', label: tNow('prompt.lowSupply', { n: formatNumber(Math.round(supplyOf(u))) }), tile: t }); }
  });
  return out;
};
