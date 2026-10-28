// src/components/ui/nextStepModel.js
// The next step (lane newcomer-flow; Civ VI's advisor, Polytopia's one clear move): after the
// guided start, one concrete thing a newcomer can do now, with a one-tap go. In the round 2
// newcomer playtest about 87 of 190 steps were End Turn or event taps: nothing pointed at the next
// action. The first that applies, in this order:
//   explore   a scout stands idle with land left to explore: send it (EXPLORE_ORDER, auto)
//   settle    fewer than STEP_CITIES cities and no settlers out or queued: queue Settlers
//   scouts    no scout and no other major met yet: queue Scouts
//   army      no land army and none queued: queue the age's infantry
//   ship      a coastal city, no ship and none queued: queue the age's first ship
//   talk      a major met in the last TALK_TURNS turns with no pact or war: its card on Peoples
//   take      an army and a known independent city within TAKE_KM of the capital: open that city
// Each step names what the go does: `queue` (city and item: the reducer's QUEUE_PRODUCTION, then
// the city's Build tab shows it), `explore` (unit ids and tile), `people` or `regionId`. Pure.
import { getTiles } from '../../data/geo/tiles';
import { canQueue } from '../../engine/world/cities';
import { getResearched, ageOf } from '../../engine/nationState';
import { tutorialPrompt } from '../../engine/tutorial';
import { isSettler, isExplorer } from '../../engine/settlers';
import { explorePath } from '../../engine/scouting';
import { hasMet, isExplored } from '../../engine/fog';
import { isIndependentNation } from '../../data/independents';
import { canAttack, exploreOn } from '../../engine/hostility';
import { tileKm } from '../../engine/tradeValue';
import { navalLinesFor } from '../../data/navalLines';
import { shortItemLabel } from '../city/cityRailModel';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';

export const STEP_CITIES = 4; // the first age's "Expand" goal; past it, settling is the player's call
export const TALK_TURNS = 10;
export const TAKE_KM = 900;

const queueOf = (c) => [c.production?.current, ...(c.production?.queue || [])].filter(Boolean);

export const nextStep = (state) => {
  const me = state.playerNationId;
  const nation = state.nations?.[me];
  if (!nation || nation.isEliminated || tutorialPrompt(state)) return null; // the guide is the next step while it runs
  const tiles = getTiles();
  const ctx = { researched: getResearched(state, me), ageId: ageOf(state, me) };
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const cities = Object.values(state.regions || {}).filter((c) => c.owner === me && c.tile != null && !c.outpost && !c.ghost && !c.razing)
    .sort((a, b) => (b.id === nation.capitalRegionId) - (a.id === nation.capitalRegionId) || b.size - a.size || (a.id < b.id ? -1 : 1));
  const allCities = Object.values(state.regions || {}).filter((c) => c.owner === me && !c.ghost);
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === me && u.strength > 0);
  const queued = (test) => cities.some((c) => queueOf(c).some(test));
  const queueStep = (id, item, test) => {
    const city = cities.find((c) => canQueue(c, tiles, world, item, ctx).ok);
    if (!city || queued(test)) return null;
    const what = shortItemLabel(item, tiles, ctx.ageId);
    return { id, label: tNow(`step.${id}`, { what }), hint: tNow('step.queueHint', { city: nameNow('city', null, city.name) }), queue: { cityId: city.id, item } };
  };

  // a scout with nothing left in reach is not asked again (explorePath finds no tile)
  const scout = units.find((u) => isExplorer(u) && u.tile != null && !u.route?.length && !u.explore?.auto && !u.hold && !u.embarkedOn && explorePath(state, u).path);
  if (scout) return { id: 'explore', label: tNow('step.explore'), explore: { unitIds: [scout.id], tile: scout.tile } };

  if (allCities.length < STEP_CITIES && !units.some(isSettler)) {
    const s = queueStep('settle', { kind: 'settler' }, (i) => i.kind === 'settler');
    if (s) return s;
  }
  const majors = Object.values(state.nations).filter((n) => n.id !== me && !n.isEliminated && !isIndependentNation(n));
  const met = majors.filter((n) => hasMet(state, me, n.id));
  if (!met.length && !units.some(isExplorer)) {
    const s = queueStep('scouts', { kind: 'unit', classId: 'support', explorer: true }, (i) => i.kind === 'unit' && i.explorer);
    if (s) return s;
  }
  if (!units.some((u) => u.domain === 'land' && !isSettler(u) && !isExplorer(u))) {
    const s = queueStep('army', { kind: 'unit', classId: 'infantry' }, (i) => (i.kind === 'unit' && !i.explorer && i.classId !== 'naval') || i.kind === 'army');
    if (s) return s;
  }
  const line = navalLinesFor(ctx.ageId)[0];
  if (line && !units.some((u) => u.domain === 'naval')) {
    const s = queueStep('ship', { kind: 'unit', classId: 'naval', navalLine: line }, (i) => i.kind === 'unit' && i.classId === 'naval');
    if (s) return s;
  }
  const turn = state.turnNumber || 1;
  const fresh = met
    .filter((n) => !n.hasMilitaryPact && !n.hasTradeAgreement && !(state.wars || []).some((w) => w.active && [w.aggressor, w.enemy].includes(n.id) && [w.aggressor, w.enemy].includes(me)))
    .map((n) => ({ n, at: Number(state.fog?.met?.[me]?.[n.id]) || 0 }))
    .filter((x) => turn - x.at <= TALK_TURNS)
    .sort((a, b) => b.at - a.at || (a.n.id < b.n.id ? -1 : 1))[0];
  if (fresh) return { id: 'talk', label: tNow('step.talk', { name: nameNow('people', fresh.n.id, fresh.n.name) }), people: fresh.n.id };

  const cap = state.regions?.[nation.capitalRegionId];
  if (cap && !exploreOn(state) && units.some((u) => u.domain === 'land' && !isSettler(u) && !isExplorer(u))) {
    const target = Object.values(state.regions || {})
      .filter((c) => c.tile != null && !c.ghost && isIndependentNation(state.nations[c.owner]) && isExplored(state, c.tile) && canAttack(state, me, c.owner))
      .map((c) => ({ c, km: tileKm(tiles, cap.tile, c.tile) }))
      .filter((x) => x.km <= TAKE_KM)
      .sort((a, b) => a.km - b.km || (a.c.id < b.c.id ? -1 : 1))[0];
    if (target) return { id: 'take', label: tNow('step.take', { city: nameNow('city', null, target.c.name) }), regionId: target.c.id };
  }
  return null;
};
