// src/engine/aiProduction.js
// What an AI city builds (plans/civ-map-rework.md, C7.5 and workstream 9's first piece; utility
// scoring from plans/math-ideas.md 3.1, see plans/math/ai.md). Pure and deterministic: the same
// city in the same state picks the same item. When the queue is empty every option the city may
// queue is scored and the best wins (ties: the order below):
//   settler   SETTLER_UTILITY (x WAR_SETTLER_MULT at war), only when the city is size
//             SETTLER_FROM_SIZE or more, the nation has no settler on the road, an outpost slot is
//             free, and a site worth SITE_SCORE_MIN is within reach (one search per nation a turn)
//   building  the next tier of each line = doctrine x need x affordability
//               doctrine       1 / (1 + DOCTRINE_RANK_DECAY x rank) in the nation's doctrine order
//                              (DOCTRINE_BUILDING_PRIORITY, the ruler's favourites first)
//               need           a response curve per line: food STARVING_NEED with no surplus, FED_NEED
//                              with FED_SURPLUS or more; defense THREAT_NEED for a city touching an
//                              enemy, WAR_NEED at war; military WAR_NEED at war or arming (a claim in
//                              the making); economy BROKE_NEED under BROKE_GOLD; else 1
//               affordability  1 up to FAST_TURNS to build, falling to SLOW_AFFORD at MAX_BUILD_TURNS
//                              (anything slower is not an option)
//   wonder    WONDER_UTILITY (x LIKED_WONDER_MULT for the doctrine's own), one turn in
//             WONDER_THINK_PERIOD, at WONDER_MIN_PRODUCTION a turn and within MAX_WONDER_TURNS
//   unit      UNIT_UTILITY in peace, ARMING_UNIT_UTILITY while arming, WAR_UNIT_UTILITY at war, while
//             the nation fields fewer land units than UNITS_PER_CITY per city: armies come before a
//             war, not after it; a major MUSTERING against an independent (phase W3, indepPolicy.js
//             `indepGoal.kind === 'muster'`) trains up to its muster cap at MUSTER_UNIT_UTILITY;
//             a major with a war plan (warPlans.js, at war or arming) trains up to the plan's `cap`
//             (a strike stack plus home garrisons, what its budget carries): a siege engine first
//             when the target has walls and it has none, archers up to PLAN_RANGED_SHARE, then foot
// Nothing scores: nothing is queued (production is banked by the queue's overflow).
// Ripples: AI expansion fills the map over the ages (C7's 50% of land by 500 CE target), AI
// buildings feed the same yields the player's do, and AI armies come from the same cities.
import { getTiles } from '../data/geo/tiles';
import { RESOURCES_ON_TILES, tileFacts, canImprove } from '../data/tileYields';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { getAvailableClasses } from '../data/unitClasses';
import { canQueue, productionCost } from './world/cities';
import { bestSites, outpostsOf, outpostSlots, settlersOf } from './settlers';
import { wonderOptions, wonderItem } from './wonders';
import { DOCTRINE_WONDERS, DOCTRINE_BUILDING_PRIORITY } from '../data/nations';
import { rulerBuildOrder } from './rulerBias';
import { getNeighborIds } from '../data/regions';
import { claimsInProgressOf } from './claims';

export const SETTLER_FROM_SIZE = 2;
export const SETTLER_THINK_PERIOD = 3; // a city looks for a site one turn in three (the site search is the costly part)
export const MAX_BUILD_TURNS = 40;
export const UNITS_PER_CITY = 1;
export const WONDER_THINK_PERIOD = 5;
export const WONDER_MIN_PRODUCTION = 6;
export const MAX_WONDER_TURNS = 30;
export const SETTLER_UTILITY = 2;
export const WAR_SETTLER_MULT = 0.5;
export const DOCTRINE_RANK_DECAY = 0.12;
export const STARVING_NEED = 1.5;
export const FED_NEED = 0.8;
export const FED_SURPLUS = 4;
export const THREAT_NEED = 2;
export const WAR_NEED = 1.3;
export const BROKE_NEED = 1.25;
export const BROKE_GOLD = 50;
export const UNREST_NEED = 1.6;
export const UNREST_NEED_AT = 25;
export const FAST_TURNS = 5;
export const SLOW_AFFORD = 0.5;
export const WONDER_UTILITY = 0.55;
export const LIKED_WONDER_MULT = 1.25;
export const UNIT_UTILITY = 0.45;
export const ARMING_UNIT_UTILITY = 1.1;
export const WAR_UNIT_UTILITY = 1.6;
export const GARRISON_UNIT_UTILITY = 1.4; // an independent below its garrison target trains first (independents.js)
export const MUSTER_UNIT_UTILITY = 1.6; // a major mustering against an independent (phase W3, indepPolicy.js) trains as at war
// Resource improvements (lead's ruling, lane W6): a resource on the city's land pays only with its
// improvement (cityEconomy.js resourceNeed: a luxury's amenity and gold, a strategic resource's
// supply, a bonus's yields), and the AI never built one, so its luxuries and iron did nothing. A
// city now builds the matching improvement on its own resource tiles, worked tiles first:
//   score = RESOURCE_IMPROVEMENT_UTILITY[kind] x (UNWORKED_IMPROVEMENT_MULT when not worked) x affordability
// Improvements are cheap (2 to 3 turns of IMPROVEMENT_COST_PER_TURN), so this is a short detour.
export const RESOURCE_IMPROVEMENT_UTILITY = { luxury: 1.3, strategic: 1.2, bonus: 1.0 };
export const UNWORKED_IMPROVEMENT_MULT = 0.6;
export const PLAN_RANGED_SHARE = 0.25; // under a war plan (warPlans.js) about a quarter of the army are archers
/** The building lines in the order a doctrine builds them, every line once (the template). */
export const buildingOrder = (doctrine) => { const liked = DOCTRINE_BUILDING_PRIORITY[doctrine] || []; return [...liked.filter((c) => BUILDING_PRIORITY.includes(c)), ...BUILDING_PRIORITY.filter((c) => !liked.includes(c))]; };
export const BUILDING_PRIORITY = ['food', 'economy', 'culture', 'science', 'industry', 'military', 'logistics', 'defense', 'naval']; // 'logistics' is the category id (buildings.js); it was listed as 'infrastructure' and the AI never built a Road Post from the template

/** The nation-wide counts the choice reads, computed once a turn for every nation (the per-city
 * scans of units and cities were the cost of the phase): { settlers, outposts, landUnits }. */
export const nationCounts = (state) => {
  const out = {};
  const of = (id) => (out[id] ||= { settlers: 0, outposts: 0, landUnits: 0, siege: 0, ranged: 0, queuedUnits: 0 });
  Object.values(state.units || {}).forEach((u) => {
    if (!u.ownerId) return;
    if (u.classId === 'settler') { of(u.ownerId).settlers += 1; return; }
    if (u.domain !== 'land') return;
    const c = of(u.ownerId); c.landUnits += 1;
    if (u.classId === 'siege') c.siege += 1; else if (u.classId === 'ranged') c.ranged += 1;
  });
  Object.values(state.regions || {}).forEach((c) => {
    if (!c.owner) return;
    if (c.outpost) of(c.owner).outposts += 1;
    else if (c.production?.current?.kind === 'unit') of(c.owner).queuedUnits += 1; // regiments in training (a war plan counts them)
  });
  return out;
};

/** The item an AI city with an empty queue should build, or null. `ctx`: { researched, ageId,
 * citiesOwned, units, counts? (nationCounts(state)[nation]) }. */
const settlerDecisions = new WeakMap(); // state.regions -> Set(nationId)
const settlerDecidedThisTurn = (state, nationId) => {
  let set = settlerDecisions.get(state.regions);
  if (!set) { set = new Set(); settlerDecisions.set(state.regions, set); }
  if (set.has(nationId)) return true;
  set.add(nationId);
  return false;
};

/** The need curve of a building line for this city (see the header). */
export const lineNeed = (category, city, situation) => {
  if (category === 'food') {
    const surplus = city.lastYields?.food;
    if (surplus == null) return 1;
    return surplus <= 0 ? STARVING_NEED : surplus >= FED_SURPLUS ? FED_NEED : 1 + (FED_NEED - 1) * surplus / FED_SURPLUS;
  }
  if (category === 'defense') return situation.threatened ? THREAT_NEED : situation.atWar ? WAR_NEED : 1;
  if (category === 'military') return situation.atWar || situation.arming ? WAR_NEED : 1;
  if (category === 'economy') return situation.broke ? BROKE_NEED : 1;
  // Culture & Order (stability and an amenity) by the city's unrest, up to UNREST_NEED at
  // UNREST_NEED_AT (lane W6: bigger empires carry more overextension, so their cities ran restless).
  if (category === 'culture') return 1 + (UNREST_NEED - 1) * Math.min(1, Math.max(0, city.unrest || 0) / UNREST_NEED_AT);
  return 1;
};

/** 1 up to FAST_TURNS, SLOW_AFFORD at MAX_BUILD_TURNS (x speed), linear between. */
export const affordability = (turns, speedMult = 1) => {
  const fast = FAST_TURNS * speedMult; const slow = MAX_BUILD_TURNS * speedMult;
  if (turns <= fast) return 1;
  return 1 - (1 - SLOW_AFFORD) * Math.min(1, (turns - fast) / Math.max(1e-9, slow - fast));
};

// The nation's war footing, once per (wars, nations) for the turn.
const situationCache = new WeakMap(); // state.wars -> Map(nationId -> { atWar, enemies, arming, broke })
const situationOf = (state, nationId) => {
  const key = state.wars || situationCache;
  let m = situationCache.get(key);
  if (!m || m.nations !== state.nations) { m = new Map(); m.nations = state.nations; situationCache.set(key, m); }
  if (m.has(nationId)) return m.get(nationId);
  const enemies = new Set();
  (state.wars || []).forEach((w) => { if (w.active && (w.aggressor === nationId || w.enemy === nationId)) enemies.add(w.aggressor === nationId ? w.enemy : w.aggressor); });
  const nation = state.nations?.[nationId];
  const out = { atWar: enemies.size > 0, enemies, arming: claimsInProgressOf(nation).length > 0, broke: (nation?.economy?.gold ?? Infinity) < BROKE_GOLD };
  m.set(nationId, out);
  return out;
};

export const chooseProduction = (state, city, ctx) => {
  if (city.outpost || city.production?.current) return null;
  const tiles = getTiles();
  const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
  const nationId = city.owner;
  const units = ctx.units || state.units || {};
  const counts = ctx.counts || { settlers: settlersOf(units, nationId).length, outposts: outpostsOf(state.regions, nationId).length, landUnits: Object.values(units).filter((u) => u.ownerId === nationId && u.domain === 'land' && u.classId !== 'settler').length };
  const production = Math.max(1, city.lastYields?.production ?? city.dev?.production ?? city.size ?? 1);
  const costOf = (item) => productionCost(item, { ageId: ctx.ageId, citiesOwned: ctx.citiesOwned, speedMult: ctx.speedMult, trainMult: ctx.trainMult });
  const affordable = (item) => costOf(item) / production <= MAX_BUILD_TURNS * (ctx.speedMult || 1);
  const situation = situationOf(state, nationId);
  const threatened = situation.atWar && getNeighborIds(city.id).some((n) => situation.enemies.has(state.regions[n]?.owner));
  const sit = { ...situation, threatened };
  let best = null; let bestScore = 0;
  const offer = (item, score) => { if (score > bestScore + 1e-9) { best = item; bestScore = score; } };

  const thinks = ((ctx.turnNumber || 0) + city.tile) % SETTLER_THINK_PERIOD === 0;
  // One settler decision per nation per turn: the first city that thinks searches for a site and
  // queues the settlers; its siblings build on (a search per city was 140 site searches a turn, and
  // every sibling queued settlers of its own against the same empty count).
  // An independent (ctx.garrisonTarget set, independents.js) never settles, never builds wonders and
  // keeps a garrison of garrisonTarget land units, first of all.
  const independent = ctx.garrisonTarget != null;
  if (!independent && thinks && city.size >= SETTLER_FROM_SIZE && counts.settlers === 0 && counts.outposts < outpostSlots(ctx.ageId) && !settlerDecidedThisTurn(state, nationId)) {
    const site = bestSites(state, nationId, city.tile, ctx.ageId, { limit: 1 })[0];
    const item = { kind: 'settler' };
    if (site && canQueue(city, tiles, world, item, ctx).ok) offer(item, SETTLER_UTILITY * (sit.atWar ? WAR_SETTLER_MULT : 1)); // bestSites already holds the quality floor
  }
  const order = rulerBuildOrder(state.nations?.[nationId], buildingOrder(state.nations?.[nationId]?.doctrine)); // the ruler's favourite lines first (rulerBias.js)
  order.forEach((category, rank) => {
    const tier = (city.buildings?.categories?.[category] ?? -1) + 1;
    if (!BUILDING_CATEGORIES[category]?.tiers[tier]) return;
    const item = { kind: 'building', category, tier };
    const doctrine = 1 / (1 + DOCTRINE_RANK_DECAY * rank);
    const need = lineNeed(category, city, sit);
    if (doctrine * need * 1 <= bestScore) return; // cannot win even at full affordability: skip the checks
    if (!affordable(item) || !canQueue(city, tiles, world, item, ctx).ok) return;
    offer(item, doctrine * need * affordability(costOf(item) / production, ctx.speedMult || 1));
  });
  // Resource improvements on the city's own land (see RESOURCE_IMPROVEMENT_UTILITY). One pass over
  // the city's tiles; tileFacts only for tiles that carry a resource.
  if (!independent && ctx.improvements !== false) {
    const worked = new Set(city.worked || []);
    for (const t of city.tiles || []) {
      const resId = tiles.resourceOf ? tiles.resourceOf(t) : null;
      if (!resId || !RESOURCES_ON_TILES[resId]) continue;
      const facts = tileFacts(tiles, t, world.tileState[t]);
      const r = RESOURCES_ON_TILES[facts.resource];
      if (!r || (facts.improvement === r.improvement && !facts.pillaged)) continue;
      const score = (RESOURCE_IMPROVEMENT_UTILITY[r.kind] || 1) * (worked.has(t) || t === city.tile ? 1 : UNWORKED_IMPROVEMENT_MULT);
      if (score <= bestScore) continue;
      const item = { kind: 'improvement', improvement: r.improvement, tile: t };
      if (!canImprove(facts, r.improvement, ctx.researched || []) || !canQueue(city, tiles, world, item, ctx).ok) continue;
      offer(item, score * affordability(costOf(item) / production, ctx.speedMult || 1));
    }
  }
  if (!independent && ctx.wonders !== false && production >= WONDER_MIN_PRODUCTION && ((ctx.turnNumber || 0) + city.tile) % WONDER_THINK_PERIOD === 0 && WONDER_UTILITY * LIKED_WONDER_MULT > bestScore) {
    const options = wonderOptions(state, city, nationId);
    if (options.length) {
      const liked = DOCTRINE_WONDERS[state.nations?.[nationId]?.doctrine] || [];
      const likedPick = liked.map((id) => options.find((o) => o.projectId === id)).find(Boolean);
      const pick = likedPick || options[0];
      const item = wonderItem(pick.projectId, pick.tier, pick.tile);
      if (costOf(item) / production <= MAX_WONDER_TURNS * (ctx.speedMult || 1)) offer(item, WONDER_UTILITY * (likedPick ? LIKED_WONDER_MULT : 1));
    }
  }
  // An independent also keeps its raid reserve (phase W2, independents.js independentCityCtx);
  // raiders ride (cavalry when the age has it).
  // A major mustering against an independent (phase W3, indepPolicy.js) trains the force it lacks.
  const goal = independent ? null : state.nations?.[nationId]?.indepGoal;
  const muster = goal?.kind === 'muster' ? goal.need || 0 : 0;
  // A war plan (warPlans.js, lane W5: at war or arming) trains toward its army cap, with a siege
  // engine for a walled target and a share of archers (PLAN_RANGED_SHARE) beside the foot.
  const plan = independent ? null : state.nations?.[nationId]?.warPlan;
  const unitCap = independent ? ctx.garrisonTarget + (ctx.raidReserve || 0) : Math.max(ctx.citiesOwned * UNITS_PER_CITY, muster ? goal.cap || 0 : 0, plan?.cap || 0);
  const classes = getAvailableClasses(ctx.ageId);
  // Under a war plan the regiments already in training count toward its cap: every idle city queued
  // one at once against the same count and the army overshot what the budget carries.
  const fielded = counts.landUnits + (plan && unitCap === plan.cap ? counts.queuedUnits || 0 : 0);
  if (fielded < unitCap && classes.includes('infantry')) {
    const mounted = independent && ctx.personality === 'raiders' && counts.landUnits >= ctx.garrisonTarget && classes.includes('cavalry');
    const score = independent ? GARRISON_UNIT_UTILITY : muster ? MUSTER_UNIT_UTILITY : sit.atWar ? WAR_UNIT_UTILITY : sit.arming ? ARMING_UNIT_UTILITY : UNIT_UTILITY;
    if (score > bestScore) {
      const options = [];
      if (plan && plan.siege && !(counts.siege > 0) && classes.includes('siege')) options.push('siege');
      if (plan && classes.includes('ranged') && (counts.ranged || 0) < PLAN_RANGED_SHARE * (counts.landUnits + 1)) options.push('ranged');
      options.push(mounted ? 'cavalry' : 'infantry');
      for (const classId of options) {
        const item = { kind: 'unit', classId };
        if (canQueue(city, tiles, world, item, ctx).ok && affordable(item)) { offer(item, score); break; }
      }
    }
  }
  return best;
};
