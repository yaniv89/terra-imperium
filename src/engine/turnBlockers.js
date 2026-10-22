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
//   capture   a city you took waits for Conquer, Raze, Make tributary or Free (capture.js)  'capture'
//   demand    a major's demand (aiAccords.js)            action 'diplomacy'
//   tribute   an independent's tribute demand (raids.js) action 'tribute'
//   join      an independent's offer to join             action 'join'
//   research  nothing researched, nothing queued, no advisor, and something can be researched  'research'
//   city      one per city with an empty build queue     action 'city'
import { GameStatus } from '../data/types';
import { demandWaiting } from './aiAccords';
import { researchNeedsChoice } from './researchStatus';
import { pendingCapturesOf } from './capture';
import { t as tNow } from '../i18n/core';
import { nameNow } from '../i18n/names';
import { getTiles } from '../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { canQueue } from './world/cities';
import { getResearched, ageOf } from './nationState';

const nameOf = (state, id) => nameNow('people', id, state.nations?.[id]?.name || tNow('prompt.aPeople'));
const cityNameOf = (state, id, fallback) => { const c = state.regions?.[id]; return c?.name ? nameNow('city', null, c.name) : fallback; };
const alive = (state, id) => !!state.nations?.[id] && !state.nations[id].isEliminated;


const defenseLabel = (state, def) => {
  const city = def.regionId ? state.regions?.[def.regionId]?.name : null;
  if (city) return tNow('prompt.block.defendCity', { city: nameNow('city', null, city) });
  if (def.kind === 'naval' || def.kind === 'intercept') return tNow('prompt.block.defendFleet');
  return tNow('prompt.block.defendArmy');
};

/** Is research idle while something could be researched (and no advisor picks)? One truth: researchStatus.js. */
export const researchIdle = (state) => researchNeedsChoice(state);

// Could the city queue anything at all (scouts, infantry, settlers, a next building tier)? A city
// with nothing valid to build never blocks the turn (playtest issue 9: no soft lock).
const canBuildSomething = (state, city) => {
  const ctx = { researched: getResearched(state, city.owner), ageId: ageOf(state, city.owner) };
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const items = [{ kind: 'unit', classId: 'support', explorer: true }, { kind: 'unit', classId: 'infantry' }, { kind: 'settler' },
    ...Object.keys(BUILDING_CATEGORIES).map((category) => ({ kind: 'building', category, tier: (city.buildings?.categories?.[category] ?? -1) + 1 }))];
  return items.some((item) => canQueue(city, tiles, world, item, ctx).ok);
};

/** The player's cities with nothing to build (outposts and burning cities build nothing; a city
 * that could queue nothing valid is not asked to), by id. */
export const idleCities = (state) => {
  const me = state.playerNationId;
  return Object.values(state.regions || {})
    .filter((c) => c.owner === me && c.tile != null && !c.outpost && !c.razing && !c.production?.current && c.tiles && canBuildSomething(state, c))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
};

export const turnBlockers = (state) => {
  if (!state || state.gameStatus !== GameStatus.ACTIVE) return [];
  const out = [];
  if (state.pendingBattle) out.push({ id: 'battle', kind: 'battle', label: tNow('prompt.block.battle'), target: null, action: 'battle' });
  if (state.activeEventId || state.activeProceduralEvent) out.push({ id: 'event', kind: 'event', label: tNow('prompt.block.event'), target: { cityId: state.activeProceduralEvent?.cityId || null }, action: 'event' });
  if (state.pendingPeaceOffer) out.push({ id: 'peace', kind: 'peace', label: tNow('prompt.block.peace', { name: nameOf(state, state.pendingPeaceOffer.from) }), target: { nationId: state.pendingPeaceOffer.from || null }, action: 'peace' });
  (state.pendingDefenses || []).forEach((def, i) => out.push({ id: `defense:${def.id ?? i}`, kind: 'defense', label: defenseLabel(state, def), target: { defenseId: def.id ?? null, regionId: def.regionId || null, tile: def.tile ?? null }, action: 'defense' }));
  pendingCapturesOf(state).forEach((c) => out.push({ id: `capture:${c.id}`, kind: 'capture', label: tNow('prompt.block.capture', { city: cityNameOf(state, c.cityId, tNow('prompt.theCity')) }), target: { captureId: c.id, regionId: c.cityId }, action: 'capture' }));
  if (demandWaiting(state)) { const d = state.pendingDemand; out.push({ id: 'demand', kind: 'demand', label: tNow(d.kind === 'city' ? 'prompt.block.demandCity' : d.kind === 'stopSettling' ? 'prompt.block.demandStop' : 'prompt.block.demandTribute', { name: nameOf(state, d.from), city: d.cityName ? nameNow('city', null, d.cityName) : tNow('prompt.aCity') }), target: { nationId: d.from }, action: 'diplomacy' }); }
  (state.tributeDemands || []).filter((d) => alive(state, d.indepId)).forEach((d) => out.push({ id: `tribute:${d.id}`, kind: 'tribute', label: tNow('prompt.block.tribute', { name: nameOf(state, d.indepId) }), target: { demandId: d.id, nationId: d.indepId }, action: 'tribute' }));
  (state.joinOffers || []).filter((o) => alive(state, o.indepId)).forEach((o) => out.push({ id: `join:${o.id}`, kind: 'join', label: tNow('prompt.block.join', { name: nameOf(state, o.indepId) }), target: { offerId: o.id, nationId: o.indepId }, action: 'join' }));
  if (researchIdle(state)) out.push({ id: 'research', kind: 'research', label: tNow('prompt.block.research'), target: null, action: 'research' });
  idleCities(state).forEach((c) => out.push({ id: `city:${c.id}`, kind: 'city', label: tNow('prompt.block.city', { city: c.name ? nameNow('city', null, c.name) : tNow('prompt.aCity') }), target: { regionId: c.id }, action: 'city' }));
  return out;
};
