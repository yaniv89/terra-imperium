// src/components/ui/nextPrompt.js
// The "next" prompt (plans/civ-map-rework.md E3): one pill above End Turn that cycles through what
// still wants a decision this turn. End Turn is never blocked. Pure: a list of prompts in order.
//   peace     a peace offer waits for an answer
//   research  nothing is being researched and the advisor is not choosing
//   city      a city with an empty build queue
//   settler   a settler with no destination
//   army      an army in the field with moves left and no route (garrisons rest in their cities)
//   unrest    a city whose unrest is UNREST_PROMPT or more
import { unitTile } from '../../engine/armies';
import { isSettler } from '../../engine/settlers';

export const UNREST_PROMPT = 50;

export const nextPrompts = (state) => {
  const me = state.playerNationId;
  const out = [];
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: 'A peace offer awaits your answer', tab: 'diplomacy' });
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
