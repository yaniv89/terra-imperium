// src/engine/cityStates.js
// City-states, decision 42 (X25): the raider cap of a new world and the patron bonus. The data,
// the types and the numbers are in src/data/cityStates.js; the independents themselves in
// independents.js (creation), raids.js (their AI) and indepPolicy.js (majors and independents).
//
// The model in plain words:
// - A new world caps its raiders at RAIDER_SHARE_MAX of its independents (data capRaiders, called
//   by independents.js finalizeIndependents).
// - Patron. On its think turns (raids.js thinksOn) a city-state that is not a raider picks its
//   patron: among the majors that have met it, hold a city within PATRON_KM and are not campaigning
//   against it, the one with the best attitude (opinion.js, the joining measure), if that is at least
//   PATRON_OPINION; ties go to the lower id. `indep.patron` keeps it until the next think turn
//   (absent on old saves: no patron until the first think turn).
// - Every turn the patron gets the type's bonus (data patronBonusOf): gold, manpower, research or
//   prestige, into the player's resources or an AI major's economy pool, the same for both.
// Runs inside processMajorsAndIndependents (indepPolicy.js) on its working copies. Deterministic.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { LogTypes } from '../data/types';
import { isIndependentNation } from '../data/independents';
import { PEOPLES } from '../data/peoples';
import { PATRON_KM, PATRON_OPINION, CITY_STATE_TYPES, cityStateTypeOf, patronBonusOf, patronBonusText } from '../data/cityStates';
import { clampPrestige } from './nationalPower';
import { opinionOf } from './opinion';
import { hasMet } from './hostility';
import { thinksOn } from './raids';
import { msg, sub, people, thing } from './messages';
import { independentAgeOf } from './ageRefs';

// patronBonusText (data/cityStates.js) as a message: "+3 gold a turn".
const patronBonusMsg = (type, ageId) => {
  const b = patronBonusOf(type, ageId);
  if (b.gold) return sub('m.world.bonusGold', { n: b.gold });
  if (b.hr) return sub('m.world.bonusManpower', { n: b.hr });
  if (b.techPoints) return sub('m.world.bonusResearch', { n: b.techPoints });
  if (b.prestige) return sub('m.world.bonusPrestige', { n: b.prestige });
  return '';
};

/** A city-state's patron now (an id or null), from the turn's view. `majorCities`: [{ owner, centre }]. */
export const choosePatron = (view, indepId, majorCities) => {
  const n = view.nations[indepId];
  const city = view.regions?.[n?.capitalRegionId];
  if (!n || n.isEliminated || !city || city.owner !== indepId || cityStateTypeOf(n) === 'raiders') return null;
  const tiles = getTiles();
  const here = tiles.centres[city.tile];
  const near = new Set();
  majorCities.forEach((c) => { if (!near.has(c.owner) && distanceKm(here, c.centre) <= PATRON_KM) near.add(c.owner); });
  let best = null; let bestA = -Infinity;
  [...near].sort().forEach((m) => {
    const major = view.nations[m];
    if (!major || major.isEliminated || isIndependentNation(major) || major.indepGoal?.id === indepId || !hasMet(view, m, indepId)) return;
    const a = opinionOf(view, indepId, m);
    if (a >= PATRON_OPINION && a > bestA) { best = m; bestA = a; }
  });
  return best;
};

const addBonus = (w, id, bonus) => {
  const n = w.nations[id];
  if (!n || n.isEliminated) return;
  if (bonus.prestige) w.nations[id] = { ...n, prestige: clampPrestige((n.prestige || 0) + bonus.prestige) };
  const pool = ['gold', 'hr', 'techPoints'].filter((k) => bonus[k]);
  if (!pool.length) return;
  if (id === w.playerId) { pool.forEach((k) => { w.resources[k] = (w.resources[k] || 0) + bonus[k]; }); return; }
  const m = w.nations[id];
  const economy = { ...(m.economy || {}) };
  pool.forEach((k) => { economy[k] = (economy[k] || 0) + bonus[k]; });
  w.nations[id] = { ...m, economy };
};

/**
 * The patrons' turn on processMajorsAndIndependents' working state `w` (nations, resources, regions,
 * view, playerId, turn, age, logs, stats): patrons are chosen on think turns, then every patron gets
 * its bonus. `indeps`: the living independents' ids, sorted.
 */
export const processPatrons = (w, indeps) => {
  const tiles = getTiles();
  let majorCities = null;
  const citiesOfMajors = () => {
    if (majorCities) return majorCities;
    majorCities = [];
    Object.values(w.regions).forEach((c) => {
      if (!c.owner || c.outpost || c.tile == null || isIndependentNation(w.nations[c.owner])) return;
      majorCities.push({ owner: c.owner, centre: tiles.centres[c.tile] });
    });
    return majorCities;
  };
  let patrons = 0;
  indeps.forEach((id) => {
    let n = w.nations[id];
    if (!n || n.isEliminated || !n.indep) return;
    if (thinksOn(id, w.turn)) {
      const patron = choosePatron(w.view, id, citiesOfMajors());
      const before = n.indep.patron || null;
      if (patron !== before) {
        const indep = { ...n.indep };
        if (patron) indep.patron = patron; else delete indep.patron;
        w.nations[id] = { ...n, indep };
        n = w.nations[id];
        const type = cityStateTypeOf(n);
        if (patron === w.playerId) w.logs.push({ year: w.year, type: LogTypes.DIPLOMACY, ...msg('m.world.patronYou', { nation: people(id, n.name), type: thing('cityStateType', type, CITY_STATE_TYPES[type].name), bonus: patronBonusMsg(type, independentAgeOf(w.view, id)) }), nationId: id });
        else if (before === w.playerId) w.logs.push({ year: w.year, type: LogTypes.DIPLOMACY, ...msg('m.world.patronLost', { nation: people(id, n.name), now: patron ? sub('m.world.patronNow', { patron: people(patron, w.nations[patron]?.name || patron) }) : '' }), nationId: id });
      }
    }
    const patron = n.indep.patron;
    if (!patron) return;
    const p = w.nations[patron];
    if (!p || p.isEliminated || isIndependentNation(p)) return;
    addBonus(w, patron, patronBonusOf(cityStateTypeOf(n), independentAgeOf(w.view, id)));
    patrons += 1;
  });
  if (w.stats) w.stats.patrons = patrons;
};

/** The patron of a city-state and what it gives: { patronId, type, text } for the UI. */
export const patronInfo = (state, indepId) => {
  const n = state.nations?.[indepId];
  const type = cityStateTypeOf(n);
  if (!type) return null;
  return { type, typeName: CITY_STATE_TYPES[type].name, patronId: n.indep?.patron || null, text: patronBonusText(type, independentAgeOf(state, indepId)), people: PEOPLES[n.people]?.name || null };
};
