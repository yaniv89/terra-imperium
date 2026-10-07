// src/components/ui/nextPromptModel.js
// The "next" prompt (plans/civ-map-rework.md E3): one pill above End Turn that cycles through what
// still wants a decision this turn. Pure: a list of prompts in order. Some of them (research, an
// idle city, a demand, a peace offer) are also End Turn's blockers (src/engine/turnBlockers.js);
// the SOFT_KINDS below never block.
//   peace     a peace offer waits for an answer
//   research  nothing is being researched and the advisor is not choosing
//   city      a city with an empty build queue
//   settler   a settler with no destination
//   army      an army in the field with moves left and no route (garrisons rest in their cities)
//   unrest    a city whose unrest is UNREST_PROMPT or more
//   guide     the guided start's current step (src/engine/tutorial.js), always first
//   demand    an AI's tribute demand waits for an answer (src/engine/aiAccords.js)
import { unitTile } from '../../engine/armies';
import { isSettler } from '../../engine/settlers';
import { tutorialPrompt } from '../../engine/tutorial';
import { demandWaiting } from '../../engine/aiAccords';
import { supplyOf, supplyZone, SUPPLY_LOW } from '../../engine/supplyMeter';
import { getTiles } from '../../data/geo/tiles';

export const UNREST_PROMPT = 50;
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
  if (!state.research?.current && !state.research?.auto) out.push({ id: 'research', kind: 'research', label: 'Choose what to research', tab: 'tech' });
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null && !c.outpost).sort((a, b) => (a.id < b.id ? -1 : 1));
  cities.forEach((c) => { if (!c.production?.current) out.push({ id: `city:${c.id}`, kind: 'city', label: `${c.name} has nothing to build`, regionId: c.id }); });
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === me && u.strength > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  units.forEach((u) => { if (isSettler(u) && u.target == null && u.tile != null) out.push({ id: `settler:${u.id}`, kind: 'settler', label: 'Settlers wait for a destination', tile: u.tile }); });
  const centres = new Set(Object.values(state.regions || {}).map((c) => c.tile));
  const seen = new Set();
  units.forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || isSettler(u) || !(u.movesLeft > 0) || u.route?.length) return;
    const t = unitTile(state, u);
    if (t == null || centres.has(t) || seen.has(t)) return;
    seen.add(t);
    out.push({ id: `army:${t}`, kind: 'army', label: 'An army in the field can still move', tile: t });
  });
  cities.forEach((c) => { if ((c.unrest || 0) >= UNREST_PROMPT) out.push({ id: `unrest:${c.id}`, kind: 'unrest', label: `${c.name} is restless (unrest ${Math.round(c.unrest)})`, regionId: c.id }); });
  // An army running out of supply (supplyMeter.js): under SUPPLY_LOW and falling.
  const lowSeen = new Set();
  units.forEach((u) => {
    if (u.domain !== 'land' || u.embarkedOn || isSettler(u) || !(u.strength > 0) || u.tile == null) return;
    const t = unitTile(state, u); if (lowSeen.has(t)) return;
    if (supplyOf(u) < SUPPLY_LOW && supplyZone(state, getTiles(), u).delta < 0) { lowSeen.add(t); out.push({ id: `supply:${t}`, kind: 'supply', label: `An army is running out of supply (${Math.round(supplyOf(u))})`, tile: t }); }
  });
  return out;
};
