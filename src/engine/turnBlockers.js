// src/engine/turnBlockers.js
// What the player must answer before the turn can end (the Civilization-style End Turn button,
// TurnDock.jsx). Pure, a player UI concept: resolveTurn's own gates (an event, a peace offer, a
// queued battle) are listed here too, but the rest (an AI demand, a tribute demand, a join offer,
// no research, a city with nothing to build) block only the button and the player's fast forward
// (gameReducer FAST_FORWARD stops on them). The AI and the headless loops never read this.
// Units with moves left never block (they stay soft hints in nextPromptModel.js).
//
// Each blocker is { id, kind, label, target, action }, in this order:
//   battle    a commanded battle is under way            action 'battle'
//   event     an event waits for an answer               action 'event'
//   peace     an AI's peace offer                        action 'peace'
//   defense   a battle others started against you, one per queued battle (Command or Auto)  'defense'
//   demand    a major's demand (aiAccords.js)            action 'diplomacy'
//   tribute   an independent's tribute demand (raids.js) action 'tribute'
//   join      an independent's offer to join             action 'join'
//   research  nothing researched, nothing queued, no advisor, and something can be researched  'research'
//   city      one per city with an empty build queue     action 'city'
import { GameStatus } from '../data/types';
import { demandWaiting } from './aiAccords';
import { suggestTechs } from './research';

const nameOf = (state, id) => state.nations?.[id]?.name || 'A people';
const alive = (state, id) => !!state.nations?.[id] && !state.nations[id].isEliminated;

const demandText = (d) => (d.kind === 'city' ? `demands ${d.cityName || 'a city'}` : d.kind === 'stopSettling' ? 'demands you stop settling' : 'demands tribute');

const defenseLabel = (state, def) => {
  const city = def.regionId ? state.regions?.[def.regionId]?.name : null;
  if (city) return `Defend ${city}: Command or Auto`;
  if (def.kind === 'naval' || def.kind === 'intercept') return 'Defend your fleet: Command or Auto';
  return 'Defend your army: Command or Auto';
};

/** Is research idle while something could be researched (and no advisor picks)? */
export const researchIdle = (state) => {
  const r = state.research;
  if (!r || r.current || r.queue?.length || r.auto) return false;
  return suggestTechs(state, state.playerNationId, 1).length > 0;
};

/** The player's cities with nothing to build (outposts and burning cities build nothing), by id. */
export const idleCities = (state) => {
  const me = state.playerNationId;
  return Object.values(state.regions || {})
    .filter((c) => c.owner === me && c.tile != null && !c.outpost && !c.razing && !c.production?.current)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
};

export const turnBlockers = (state) => {
  if (!state || state.gameStatus !== GameStatus.ACTIVE) return [];
  const out = [];
  if (state.pendingBattle) out.push({ id: 'battle', kind: 'battle', label: 'Finish the battle', target: null, action: 'battle' });
  if (state.activeEventId || state.activeProceduralEvent) out.push({ id: 'event', kind: 'event', label: 'Answer the event', target: { cityId: state.activeProceduralEvent?.cityId || null }, action: 'event' });
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: `Answer: ${nameOf(state, state.pendingPeaceOffer.from)} offers peace`, target: { nationId: state.pendingPeaceOffer.from || null }, action: 'peace' });
  (state.pendingDefenses || []).forEach((def, i) => out.push({ id: `defense:${def.id ?? i}`, kind: 'defense', label: defenseLabel(state, def), target: { defenseId: def.id ?? null, regionId: def.regionId || null, tile: def.tile ?? null }, action: 'defense' }));
  if (demandWaiting(state)) { const d = state.pendingDemand; out.push({ id: 'demand', kind: 'demand', label: `Answer: ${nameOf(state, d.from)} ${demandText(d)}`, target: { nationId: d.from }, action: 'diplomacy' }); }
  (state.tributeDemands || []).filter((d) => alive(state, d.indepId)).forEach((d) => out.push({ id: `tribute:${d.id}`, kind: 'tribute', label: `Answer: ${nameOf(state, d.indepId)} demands tribute`, target: { demandId: d.id, nationId: d.indepId }, action: 'tribute' }));
  (state.joinOffers || []).filter((o) => alive(state, o.indepId)).forEach((o) => out.push({ id: `join:${o.id}`, kind: 'join', label: `Answer: ${nameOf(state, o.indepId)} offers to join`, target: { offerId: o.id, nationId: o.indepId }, action: 'join' }));
  if (researchIdle(state)) out.push({ id: 'research', kind: 'research', label: 'Choose research', target: null, action: 'research' });
  idleCities(state).forEach((c) => out.push({ id: `city:${c.id}`, kind: 'city', label: `Choose production: ${c.name || 'a city'}`, target: { regionId: c.id }, action: 'city' }));
  return out;
};
