// src/engine/crises.js
// History crises (differentiation plan U31, KTD14): world crises that come from conditions, not dates.
// Every CHECK_PERIOD turns, for each crisis in src/data/crises.js not resting:
//   hit     = the majors inside its age window (their research age) that meet its `hits` predicate
//   starts  when |hit| >= minHit, its raiders exist (if it needs them) and a seeded roll < CRISIS_CHANCE
// At most one starts a check, and none within CRISIS_GAP reference turns of the last. It hits MAX_HIT
// of `hit` drawn by a seeded roll (follow-up 25: the player as often as any other, no weight, no
// immunity), WARN_TURNS reference turns later (state.crises.coming: the player's warning, CrisisBanner
// and the "needs you" chip), once, through existing systems (no unit of the player's is ever moved, R29):
//   collapse  outer cities (not capitals) lose COLLAPSE_LOYALTY loyalty: loyalty.js may let them go
//   surge     each raider independent within SURGE_KM of a hit city gets SURGE_BANDS war bands (raids.js)
//   plague    an outbreak (plague.js) in each hit nation's largest city
//   famine    every city of a hit nation loses FAMINE_SHARE of its people (the population model), halved
//             by a Granary or better (the Food line)
//   war       the first two hit majors go to war (declareWar, pacts join); the player is only ever the target
// A hit player gets the crisis's opening story (an event-deck link, due when it strikes); a player
// inside its age window that it spares gets its answer card (events-8: aid, profit or stay out,
// bound to the struck majors, after Civ VI's emergencies). Memory:
// state.crises = { last: { id: turn }, lastAny, history: [{ id, turn, nations }], coming?: { id, turn,
// nations, raiders, answered?, choice? } }; absent = none yet (save 20: all optional, no migration).
// `answered`: the player opened the card during the warning (ANSWER_CRISIS_EARLY), so it does not open
// again at the strike; `choice`: the option picked then, paid only when the crisis strikes the player (a
// crisis dropped or passing pays nothing).
// state.settings.crises === 'off' stops all. Pure apart from the turn's working regions and units.
import { CRISES, crisisCardId, crisisAnswerId } from '../data/crises';
import { getAgeIndex, speedTurns, speedCostMult } from '../data/ages';
import { ageOf } from './nationState';
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
export const WARN_TURNS = 5;          // reference turns between the warning and the strike
export const COLLAPSE_LOYALTY = 35;
export const SURGE_KM = 1200;
export const SURGE_BANDS = 2;
export const PLAGUE_I = 0.1;
export const FAMINE_SHARE = 0.1;
export const GRANARY_TIER = 1;        // the Food line's Granary (buildings.js food tiers) or any later tier

/** The share of its people a city loses to a famine: FAMINE_SHARE, halved by a Granary or better. */
export const famineShare = (city) => FAMINE_SHARE * ((city.buildings?.categories?.food ?? -1) >= GRANARY_TIER ? 0.5 : 1);

export const crisesOn = (state) => state.settings?.crises !== 'off' && state.settings?.explore !== true;

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
  if (mem.coming) return null;
  const age = waitAgeOf(state);
  if (mem.lastAny != null && turn - mem.lastAny < speedTurns(CRISIS_GAP, state.gameSpeed, age)) return null;
  const ctxs = new Map();
  const ctxOf = (id) => { if (!ctxs.has(id)) ctxs.set(id, factContext(state, id)); return ctxs.get(id); };
  for (const crisis of CRISES) {
    const last = mem.last?.[crisis.id];
    if (last != null && turn - last < speedTurns(crisis.cooldown, state.gameSpeed, age)) continue;
    const all = hitNations(state, crisis, ctxOf);
    if (all.length < crisis.minHit) continue;
    const roll = (id) => hashRoll(`${state.rngSeed}|crisisHit|${crisis.id}|${turn}|${id}`);
    const hit = all.map((id) => [roll(id), id]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)).slice(0, MAX_HIT).map((x) => x[1]);
    const raiders = raidersNear(state, crisis, hit);
    if (crisis.raiders && !raiders.length) continue;
    if (hashRoll(`${state.rngSeed}|crisis|${crisis.id}|${turn}`) >= CRISIS_CHANCE) continue;
    return { crisis, hit, raiders: raiders.slice(0, MAX_HIT) };
  }
  return null;
};

/** The crisis announced against the player, as { crisis, turn, nations }, or null (the warning). */
export const crisisComing = (state) => {
  const c = state.crises?.coming;
  const crisis = c && crisesOn(state) && c.nations.includes(state.playerNationId) && CRISES.find((x) => x.id === c.id);
  return crisis ? { crisis, turn: c.turn, nations: c.nations, answered: !!c.answered } : null;
};

/**
 * Announce this turn's crisis, if one is due (it strikes WARN_TURNS reference turns later), or strike
 * the announced one whose warning ran out. `state` carries the new turnNumber and the turn's working
 * `regions` and `units` (written in place), `nations` and `wars`.
 * @returns {null | { nations, wars, crises, pendingEventChains, logs, choice? }} (`choice`: the option the
 * player picked during the warning, paid by resolveTurn now that it struck)
 */
export const processCrises = (state) => {
  const turn = state.turnNumber;
  const mem = state.crises || {};
  let { nations, wars } = state;
  if (!mem.coming) {
    const due = crisisDue(state);
    if (!due) return null;
    const coming = { id: due.crisis.id, turn: turn + speedTurns(WARN_TURNS, state.gameSpeed, waitAgeOf(state)), nations: due.hit, raiders: due.raiders };
    return { nations, wars, crises: { ...mem, last: { ...mem.last, [due.crisis.id]: turn }, lastAny: turn, coming }, pendingEventChains: state.pendingEventChains, logs: [] };
  }
  const { coming, ...rest } = mem;
  // Crises switched off while one was coming: drop it, so it never strikes later unannounced.
  if (!crisesOn(state)) return { nations, wars, crises: rest, pendingEventChains: state.pendingEventChains, logs: [] };
  if (turn < coming.turn) return null;
  const crisis = CRISES.find((c) => c.id === coming.id);
  if (!crisis) return { nations, wars, crises: rest, pendingEventChains: state.pendingEventChains, logs: [] };
  const alive = (id) => nations[id] && !nations[id].isEliminated;
  const hit = coming.nations.filter(alive);
  const raiders = (coming.raiders || []).filter(alive);
  const { regions, units } = state;
  const hitSet = new Set(hit);
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
    owned.forEach((id) => { const c = regions[id]; regions[id] = drawPeople(c, famineShare(c) * (c.currentPopulation || sizeToPeople(c.size)), { canShrink: true, speedMult: speedCostMult(state.gameSpeed, ageOf(state, c.owner)) }); }); // the store sized as resolveTurn sizes it
  } else if (crisis.effect === 'war') {
    // The player is never made the aggressor (no forced loss of control): a hit player is the target.
    const [a, b] = hit[0] === state.playerNationId ? [hit[1], hit[0]] : hit;
    const after = a && b ? declareWar({ ...state, nations, wars }, b, { aggressor: a }) : null;
    if (!after || after.wars === wars) return { nations, wars, crises: rest, pendingEventChains: state.pendingEventChains, logs: [] }; // no war to start: it passes
    ({ nations, wars } = after);
  }
  const crises = { ...rest, history: [...(mem.history || []), { id: crisis.id, turn, nations: hit }] };
  const me = state.playerNationId;
  // A player it spares but whose age it covers gets its answer card (aid, profit or stay out), bound to the struck.
  const spared = !hitSet.has(me) && hit.length > 0 && alive(me) && predicateMet(ruleOf({ ...crisis, hits: { all: [] } }), factContext(state, me));
  const pendingEventChains = hitSet.has(me) && !coming.answered ? [...(state.pendingEventChains || []), { id: crisisCardId(crisis.id), dueTurn: turn }]
    : spared ? [...(state.pendingEventChains || []), { id: crisisAnswerId(crisis.id), dueTurn: turn, nations: hit }] : state.pendingEventChains;
  const choice = hitSet.has(state.playerNationId) && Number.isInteger(coming.choice) ? coming.choice : undefined;
  return { nations, wars, crises, pendingEventChains, choice, logs: [{ year: state.year, type: 'milestone', ...msg(`m.world.crisis.${crisis.id}`) }] };
};
