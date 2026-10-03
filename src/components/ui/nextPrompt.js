// src/components/ui/nextPrompt.js
// The "next" prompt (plans/civ-map-rework.md E3): one pill above End Turn that cycles through what
// still wants a decision this turn. End Turn is never blocked. Pure: a list of prompts in order.
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

export const UNREST_PROMPT = 50;
export const WARN_ARM_MS = 4000;

/** With the "warn me" setting on: how many prompts (the guide aside) still wait before End Turn; 0 otherwise. */
export const endTurnWarnings = (state) => (state.battleSettings?.warnEndTurn ? nextPrompts(state).filter((p) => p.kind !== 'guide').length : 0);

export const nextPrompts = (state) => {
  const me = state.playerNationId;
  const out = [];
  const guide = tutorialPrompt(state);
  if (guide) out.push(guide);
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: 'A peace offer awaits your answer', tab: 'diplomacy' });
  if (demandWaiting(state)) out.push({ id: 'demand', kind: 'demand', label: `${state.nations[state.pendingDemand.from].name} demands ${state.pendingDemand.amount} gold`, tab: 'diplomacy' });
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
  return out;
};
