// src/engine/crises.js
// History crises (differentiation plan U31, KTD14): world crises that come from conditions, not dates.
// Every CHECK_PERIOD turns, for each crisis in src/data/crises.js not resting:
//   hit     = the majors inside its age window (their research age) that meet its `hits` predicate
//   starts  when |hit| >= minHit, its raiders exist (if it needs them) and a seeded roll < CRISIS_CHANCE
// At most one starts a check, and none within CRISIS_GAP reference turns of the last. It hits the
// MAX_HIT largest of `hit` once, through existing systems (no unit of the player's is ever moved, R29):
//   collapse  outer cities (not capitals) lose COLLAPSE_LOYALTY loyalty: loyalty.js may let them go
//   surge     each raider independent within SURGE_KM of a hit city gets SURGE_BANDS war bands (raids.js)
//   plague    an outbreak (plague.js) in each hit nation's largest city
//   famine    every city of a hit nation loses FAMINE_SHARE of its people (the population model)
//   war       the two largest hit majors other than the player go to war (declareWar, pacts join)
// A hit player gets the crisis's opening story (an event-deck link, due now). Memory: state.crises =
// { last: { id: turn }, lastAny, history: [{ id, turn, nations }] }; absent = none yet.
// state.settings.crises === 'off' stops all. Pure apart from the turn's working regions and units.
import { CRISES, crisisCardId } from '../data/crises';
import { getAgeIndex, speedTurns } from '../data/ages';
import { isIndependentNation } from '../data/independents';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { factContext, predicateMet } from './predicates';
import { hashRoll } from './aftermath';
import { waitAgeOf } from './ageRefs';
import { seedPlague } from './plague';
import { drawPeople, sizeToPeople } from './world/cities';
import { loyaltyOf } from './loyalty';
import { declareWar } from './diplomacy';
import { msg } from './messages';

export const CHECK_PERIOD = 5;
export const CRISIS_CHANCE = 0.1;     // per check, per crisis whose conditions hold
export const CRISIS_GAP = 60;         // reference turns between any two crises
export const MAX_HIT = 6;
export const COLLAPSE_LOYALTY = 35;
export const SURGE_KM = 1200;
export const SURGE_BANDS = 2;
export const PLAGUE_I = 0.1;
export const FAMINE_SHARE = 0.1;

export const crisesOn = (state) => state.settings?.crises !== 'off';

const ruleOf = (c) => ({ all: [{ fact: 'ageIndex', min: getAgeIndex(c.ages[0]), max: getAgeIndex(c.ages[1]) }, c.hits] });

/** The majors a crisis would hit now, largest first (`ctxOf`: shared fact contexts). */
export const hitNations = (state, crisis, ctxOf = (id) => factContext(state, id)) => {
  const size = {};
  Object.values(state.regions || {}).forEach((c) => { if (c.owner) size[c.owner] = (size[c.owner] || 0) + 1; });
  return Object.keys(state.nations || {})
    .filter((id) => !state.nations[id].isEliminated && !isIndependentNation(state.nations[id]) && predicateMet(ruleOf(crisis), ctxOf(id)))
    .sort((a, b) => (size[b] || 0) - (size[a] || 0) || (a < b ? -1 : 1));
};

/** Raider independents of the crisis's kind (coast or inland) within SURGE_KM of a hit city. */
export const raidersNear = (state, crisis, hit) => {
  if (!crisis.raiders) return [];
  const tiles = getTiles();
  const hitSet = new Set(hit);
  const spots = Object.values(state.regions || {}).filter((c) => hitSet.has(c.owner)).map((c) => tiles.centres[c.tile]);
  return Object.values(state.nations || {})
    .filter((n) => isIndependentNation(n) && !n.isEliminated && n.indep?.personality === 'raiders')
    .filter((n) => {
      const home = state.regions?.[n.capitalRegionId];
      return home && (tiles.coastal[home.tile] === 1) === (crisis.raiders === 'coast') && spots.some((p) => distanceKm(tiles.centres[home.tile], p) <= SURGE_KM);
    })
    .map((n) => n.id).sort();
};

/** The crisis that starts this turn, as { crisis, hit, raiders }, or null. */
export const crisisDue = (state) => {
  const turn = state.turnNumber || 0;
  if (!crisesOn(state) || turn % CHECK_PERIOD !== 0) return null;
  const mem = state.crises || {};
  const age = waitAgeOf(state);
  if (mem.lastAny != null && turn - mem.lastAny < speedTurns(CRISIS_GAP, state.gameSpeed, age)) return null;
  const ctxs = new Map();
  const ctxOf = (id) => { if (!ctxs.has(id)) ctxs.set(id, factContext(state, id)); return ctxs.get(id); };
  for (const crisis of CRISES) {
    const last = mem.last?.[crisis.id];
    if (last != null && turn - last < speedTurns(crisis.cooldown, state.gameSpeed, age)) continue;
    const hit = hitNations(state, crisis, ctxOf);
    if (hit.length < crisis.minHit) continue;
    const raiders = raidersNear(state, crisis, hit);
    if (crisis.raiders && !raiders.length) continue;
    if (hashRoll(`${state.rngSeed}|crisis|${crisis.id}|${turn}`) >= CRISIS_CHANCE) continue;
    return { crisis, hit: hit.slice(0, MAX_HIT), raiders: raiders.slice(0, MAX_HIT) };
  }
  return null;
};

/**
 * Start this turn's crisis, if one is due. `state` carries the new turnNumber and the turn's working
 * `regions` and `units` (written in place), `nations` and `wars`.
 * @returns {null | { nations, wars, crises, pendingEventChains, logs }}
 */
export const processCrises = (state) => {
  const due = crisisDue(state);
  if (!due) return null;
  const { crisis, hit, raiders } = due;
  const { regions, units } = state;
  const turn = state.turnNumber;
  const hitSet = new Set(hit);
  let { nations, wars } = state;
  const owned = Object.keys(regions).filter((id) => hitSet.has(regions[id].owner));
  if (crisis.effect === 'collapse') {
    owned.forEach((id) => { const c = regions[id]; if (!c.isCapital) regions[id] = { ...c, loyalty: Math.max(0, loyaltyOf(c) - COLLAPSE_LOYALTY) }; });
  } else if (crisis.effect === 'surge') {
    raiders.forEach((rid) => {
      const home = regions[nations[rid].capitalRegionId];
      for (let k = 0; k < SURGE_BANDS; k++) {
        const id = `crisis_${crisis.id}_${turn}_${rid}_${k}`;
        units[id] = { id, ownerId: rid, regionId: home.id, homeRegionId: home.id, tile: home.tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, rank: 'recruit', commanderId: null, promotions: [], xp: 0 };
      }
    });
  } else if (crisis.effect === 'plague') {
    hit.forEach((nid) => {
      const big = owned.filter((id) => regions[id].owner === nid).sort((a, b) => (regions[b].size || 0) - (regions[a].size || 0) || (a < b ? -1 : 1))[0];
      if (big) regions[big] = seedPlague(regions[big], turn, PLAGUE_I);
    });
  } else if (crisis.effect === 'famine') {
    owned.forEach((id) => { const c = regions[id]; regions[id] = drawPeople(c, FAMINE_SHARE * (c.currentPopulation || sizeToPeople(c.size)), { canShrink: true }); });
  } else if (crisis.effect === 'war') {
    const [a, b] = hit.filter((id) => id !== state.playerNationId);
    if (!b) return null;
    const after = declareWar({ ...state, nations, wars }, b, { aggressor: a });
    if (after.wars === wars) return null;
    ({ nations, wars } = after);
  }
  const mem = state.crises || {};
  const crises = { last: { ...mem.last, [crisis.id]: turn }, lastAny: turn, history: [...(mem.history || []), { id: crisis.id, turn, nations: hit }] };
  const pendingEventChains = hitSet.has(state.playerNationId) ? [...(state.pendingEventChains || []), { id: crisisCardId(crisis.id), dueTurn: turn }] : state.pendingEventChains;
  return { nations, wars, crises, pendingEventChains, logs: [{ year: state.year, type: 'milestone', ...msg(`m.world.crisis.${crisis.id}`) }] };
};
