// src/engine/stonePhase.js
// The Stone Age's two phases (eight-ages plan U25, KTD13), derived from research and never stored:
// a nation in the Stone Age is in the village phase until it knows Agriculture and Chiefdoms, then
// in the first-cities phase. Outside the Stone Age a nation has no phase (null).
//   village       Tribal government only (government.js minPhase); laws only on land and justice;
//                 a village stops at VILLAGE_SIZE_CAP (FORAGE_SIZE_CAP before Agriculture, hearths.js)
//   first cities  Monarchy and Theocracy open; a city gets RIVER_FOOD more food per river tile it works
// Whatever the age, research costs NO_WRITING_COST_MULT more until the nation knows Proto-Writing
// (the plan's "science halved", research.js getResearchCost).
import { FIRST_AGE_ID } from '../data/ages';
import { ageOf, getResearched } from './nationState';

export const FIRST_CITIES_TECHS = ['economy_agriculture', 'governance_chiefdoms'];
export const WRITING_TECH = 'science_proto_writing';
export const NO_WRITING_COST_MULT = 2;
export const VILLAGE_LAW_CATEGORIES = ['land', 'justice'];
export const RIVER_FOOD = 1;
export const VILLAGE_SIZE_CAP = 4;

/** 'village', 'cities' or null (not in the Stone Age). */
export const stonePhaseOf = (state, nationId) => {
  if (ageOf(state, nationId) !== FIRST_AGE_ID) return null;
  const known = getResearched(state, nationId);
  return FIRST_CITIES_TECHS.every((id) => known.includes(id)) ? 'cities' : 'village';
};

/** Can this nation take a city? Not in the village phase (eight-ages plan U32, 2026-10-03 plan 9.1):
 * a war before Chiefdoms is a raid, its win at a city is loot. One rule for war goals, battles and peace terms. */
export const canAnnex = (state, nationId) => stonePhaseOf(state, nationId) !== 'village';

/** The city context of a nation's phase (resolveTurn nationCtx, cityEconomy cityCtx). A village that
 * still forages keeps forageCtx's lower cap (spread before this one). */
export const stonePhaseCtx = (state, nationId) => {
  const phase = stonePhaseOf(state, nationId);
  if (phase === 'cities') return { riverFood: RIVER_FOOD };
  return phase === 'village' && getResearched(state, nationId).includes(FIRST_CITIES_TECHS[0]) ? { maxSize: VILLAGE_SIZE_CAP } : {};
};

/** The settle wording follows the age's settlement: in the village phase `key` + 'Village' ("Found Village here"). */
export const settleKey = (state, nationId, key) => (stonePhaseOf(state, nationId) === 'village' ? `${key}Village` : key);
