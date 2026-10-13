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
//   unrest    a city whose unrest is UNREST_PROMPT or more
//   guide     the guided start's current step (src/engine/tutorial.js), always first
//   demand    an AI's tribute demand waits for an answer (src/engine/aiAccords.js)
//   war       a people declared war on you in the last WAR_NOTICE_TURNS turns (a notice: it never blocks
//             End Turn, stays on screen while other answers are given, and opens Peoples; I117)
import { unitTile } from '../../engine/armies';
import { isSettler } from '../../engine/settlers';
import { tutorialPrompt } from '../../engine/tutorial';
import { demandWaiting } from '../../engine/aiAccords';
import { researchNeedsChoice } from '../../engine/researchStatus';
import { supplyOf, supplyZone, SUPPLY_LOW } from '../../engine/supplyMeter';
import { getTiles } from '../../data/geo/tiles';
import { idleArmyTiles } from '../../engine/standingOrders';

export const UNREST_PROMPT = 50;
export const WAR_NOTICE_TURNS = 3; // turns of play a declaration stays as a chip (an on-screen notice, not a span of history)
export const WARN_ARM_MS = 4000;

// The prompts that never block End Turn (the rest are End Turn's blockers, src/engine/turnBlockers.js):
// units that can still move or wait for orders, a restless city, an army low on supply.
export const SOFT_KINDS = new Set(['army', 'settler', 'unrest', 'supply']);
/** The soft hints that still wait (the "warn me" setting's list). */
export const softHints = (state) => nextPrompts(state).filter((p) => SOFT_KINDS.has(p.kind));
/** With the "warn me" setting on: how many soft hints still wait before End Turn; 0 otherwise. */
export const endTurnWarnings = (state) => (state.battleSettings?.warnEndTurn ? softHints(state).length : 0);

export const nextPrompts = (state) => {
  const me = state.playerNationId;
  const out = [];
  const guide = tutorialPrompt(state);
  if (guide) out.push(guide);
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: 'A peace offer awaits your answer', tab: 'diplomacy' });
  if (demandWaiting(state)) { const d = state.pendingDemand; out.push({ id: 'demand', kind: 'demand', label: `${state.nations[d.from].name} demands ${d.kind === 'city' ? d.cityName || 'a city' : d.kind === 'stopSettling' ? 'a stop to your settling' : `${d.amount} gold`}`, tab: 'diplomacy' }); }
  // A war declared on the player lately: the log line alone was easy to miss (I117).
  (state.wars || []).forEach((w) => { if (w.active && w.enemy === me && w.aggressor && state.nations?.[w.aggressor] && (state.turnNumber || 0) - (w.startTurn ?? -Infinity) < WAR_NOTICE_TURNS) out.push({ id: 'war:' + w.id, kind: 'war', label: state.nations[w.aggressor].name + ' declared war on you', tab: 'diplomacy', nationId: w.aggressor }); });
  if (researchNeedsChoice(state)) out.push({ id: 'research', kind: 'research', label: 'Choose what to research', tab: 'tech' });
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null && !c.outpost).sort((a, b) => (a.id < b.id ? -1 : 1));
  cities.forEach((c) => { if (!c.production?.current) out.push({ id: `city:${c.id}`, kind: 'city', label: `${c.name} has nothing to build`, regionId: c.id }); });
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === me && u.strength > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  units.forEach((u) => { if (isSettler(u) && u.target == null && u.tile != null) out.push({ id: `settler:${u.id}`, kind: 'settler', label: 'Settlers wait for a destination', tile: u.tile }); });
  // Idle armies (src/engine/standingOrders.js idleArmyTiles): a stack that marches, holds (the
  // Hold order), besieges a city or garrisons one is busy, not idle.
  idleArmyTiles(state, me).forEach((t) => out.push({ id: `army:${t}`, kind: 'army', label: 'An army in the field can still move', tile: t }));
  cities.forEach((c) => { if ((c.unrest || 0) >= UNREST_PROMPT) out.push({ id: `unrest:${c.id}`, kind: 'unrest', label: `${c.name} is restless (unrest ${Math.round(c.unrest)})`, regionId: c.id }); });
  // An army running out of supply (supplyMeter.js): under SUPPLY_LOW and falling.
  const lowSeen = new Set();
  units.forEach((u) => {
    if (u.domain !== 'land' || u.embarkedOn || isSettler(u) || !(u.strength > 0) || u.tile == null) return;
    const t = unitTile(state, u); if (lowSeen.has(t)) return;
    const zone = supplyZone(state, getTiles(), u);
    // At an empty meter outside home land the stack starves even where the meter only holds.
    if (supplyOf(u) <= 0 && zone.zone !== 'home') { lowSeen.add(t); out.push({ id: `supply:${t}`, kind: 'supply', label: 'An army is starving (supply 0)', tile: t }); } else if (supplyOf(u) < SUPPLY_LOW && zone.delta < 0) { lowSeen.add(t); out.push({ id: `supply:${t}`, kind: 'supply', label: `An army is running out of supply (${Math.round(supplyOf(u))})`, tile: t }); }
  });
  return out;
};
