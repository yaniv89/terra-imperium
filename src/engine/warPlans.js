// src/engine/warPlans.js
// War plans for AI majors (lane W5, the user's ruling of 14 October: "bigger AI armies").
// Cities fall only to attacks (cityAssault.js: the garrison first, then the empty city's HP), so a
// war needs a real army at the walls, not single regiments trickling in. An AI major at war, or
// arming for one (a claim in the making, claims.js), keeps ONE plan (`nation.warPlan`):
//
//   target   the enemy city it means to take: the war's goal city when there is one, else the
//            enemy city nearest its own cities (ties: the richer, then by id); kept while it is
//            still the enemy's. While arming: the city the claim is on.
//   staging  its own city nearest the target (not an outpost when it has another): the muster point
//            where new regiments gather into one strike stack.
//   strike   the units the strike stack needs:
//              ceil(STRIKE_PER_GARRISON x garrison units + STRIKE_PER_WALL x wall levels
//                   + STRIKE_PER_SIZE x city size), held between STRIKE_MIN and STRIKE_MAX[age]
//            (garrison units = the strength of the owner's land units in the city / 1000).
//   cap      the land army it trains toward (aiProduction.js reads it):
//              min(ceil(HOME_PER_CITY x cities) + strike, WAR_UNITS_PER_CITY x cities, payable)
//            and never under the peacetime cap (cities x UNITS_PER_CITY). `payable` is what its
//            income and treasury carry: units now + net income / (UPKEEP_MARGIN x upkeep) + gold /
//            (upkeep x WAR_CHEST_TURNS), so the plan never buys an army the budget (aiBudget.js) must disband.
//   siege    whether the strike wants a siege engine (the target has walls and the age has one).
//
// The march (aiOperations.js): stacks that cannot win where they stand gather at the staging city;
// the stack there marches on the target once it holds GO_SHARE of the strike (later waves:
// WAVE_SHARE), or after GATHER_MAX_TURNS with at least GATHER_MIN_UNITS. Then it fights the
// garrison and attacks the city as before (the assault rules are unchanged).
// Ripples: production (more and mixed units at war), the treasury (upkeep, the budget's cuts),
// battles per war and captures, and the defender's threat picture (a big stack near a border
// city makes it 'threatened', threat.js).
// Pure and deterministic: no randomness; ties by id. New persisted field: nation.warPlan
// (absent = no plan; every reader defaults it); plan.unreachable: targets its strike found no road to.
import { getTiles } from '../data/geo/tiles';
import { ringsApart, kmPerRing } from '../data/geo/gridScale';
import { canFight, exploreOn } from './hostility';
import { MOVE_KM, DEFAULT_MOVE_KM } from './armies';
import { NAVAL_KM_BY_AGE } from './fleets';
import { wallsOf } from './sieges';
import { getTotalDev } from './development';
import { getUnlockedClasses } from '../data/unitClasses';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { unitUpkeepGold } from './economy';
import { claimsInProgressOf } from './claims';
import { speedTurns } from '../data/ages';
import { getResearched, ageOf } from './nationState';
import { waitAgeOf } from './ageRefs';

export const STRIKE_PER_GARRISON = 2;
export const STRIKE_PER_WALL = 1.5;
export const STRIKE_PER_SIZE = 0.5;
export const STRIKE_MIN = 4;
export const STRIKE_MAX = { stone: 6, bronze: 8, classical: 10, kingdoms: 12, gunpowder: 14, modern: 16, information: 18, future: 20 };
export const STRIKE_MAX_DEFAULT = 8;
export const HOME_PER_CITY = 1;
export const WAR_UNITS_PER_CITY = 3;
export const WAR_CHEST_TURNS = 30;
export const UPKEEP_MARGIN = 1.5; // a new unit is reckoned at 1.5 x its upkeep (marches, war costs)
export const GO_SHARE = 0.6;
export const WAVE_SHARE = 0.5;
export const GATHER_MAX_TURNS = 6;
export const GATHER_MIN_UNITS = 2;
export const UNIT_STRENGTH = 1000;
export const PEACE_UNITS_PER_CITY = 1;
export const PEACE_GARRISON_MAX = 6; // land units a city keeps at peace (aiOperations.js spreadGarrisons, aiLogic.js recruits) // aiProduction.js UNITS_PER_CITY (kept here to avoid an import cycle)

const isLandArmy = (u) => u.domain === 'land' && u.classId !== 'settler' && !u.embarkedOn && u.strength > 0;

/** The owner's land units standing in the city (its garrison), in units of UNIT_STRENGTH. */
export const garrisonUnits = (state, city) => {
  let s = 0;
  for (const u of Object.values(state.units || {})) {
    if (u.ownerId === city.owner && u.regionId === city.id && isLandArmy(u) && (u.tile == null || u.tile === city.tile)) s += u.strength;
  }
  return s / UNIT_STRENGTH;
};

/** Units the strike stack needs against `city` (see the header). */
export const strikeSize = (state, city, ageId) => {
  const raw = STRIKE_PER_GARRISON * garrisonUnits(state, city) + STRIKE_PER_WALL * wallsOf(city) + STRIKE_PER_SIZE * (city.size || 1);
  return Math.max(STRIKE_MIN, Math.min(STRIKE_MAX[ageId] || STRIKE_MAX_DEFAULT, Math.ceil(raw - 1e-9)));
};

/** Land units (not settlers) a nation fields. */
export const landUnitsOf = (state, nationId) => Object.values(state.units || {}).filter((u) => u.ownerId === nationId && u.domain === 'land' && u.classId !== 'settler').length;

/** How many land units the nation's income and treasury carry (see the header). */
// `upkeep`: a new unit's gold a turn at the nation's age (economy.js unitUpkeepGold).
export const payableUnits = (nation, landUnits, upkeep = UNIT_UPKEEP_GOLD_PER_TURN) => {
  const net = nation?.lastNetIncome ?? 0;
  const gold = nation?.economy?.gold ?? 0;
  return landUnits + Math.floor(Math.max(0, net) / (upkeep * UPKEEP_MARGIN) + Math.max(0, gold) / (upkeep * WAR_CHEST_TURNS));
};

/** The army a plan trains toward (see the header). */
export const armyCap = (nation, cities, strike, landUnits, upkeep = UNIT_UPKEEP_GOLD_PER_TURN) => {
  const peace = cities * PEACE_UNITS_PER_CITY;
  const want = Math.min(Math.ceil(HOME_PER_CITY * cities) + strike, Math.floor(WAR_UNITS_PER_CITY * cities));
  return Math.max(peace, Math.min(want, payableUnits(nation, landUnits, upkeep)));
};

const ownCities = (state, nationId) => Object.values(state.regions).filter((c) => c.owner === nationId && c.tile != null && !(c.occupiedBy && c.occupiedBy !== nationId));

/** The enemy city to go for: the goal, else the nearest to our cities (ties: richer, then id). */
export const pickTargetCity = (state, nationId, enemies, goalIds = [], mine = ownCities(state, nationId), maxRings = Infinity, skip = []) => {
  const goal = goalIds.map((id) => state.regions[id]).find((c) => c && enemies.has(c.owner) && c.tile != null && !skip.includes(c.id));
  if (goal) return goal.id;
  if (!mine.length) return null;
  const tiles = getTiles();
  let best = null; let bestD = Infinity; let bestDev = -1;
  for (const c of Object.values(state.regions)) {
    if (!enemies.has(c.owner) || c.tile == null || skip.includes(c.id)) continue;
    let d = Infinity;
    for (const m of mine) { const r = ringsApart(m.tile, c.tile, tiles); if (r < d) d = r; }
    if (d > maxRings) continue;
    const dev = getTotalDev(c);
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && (dev > bestDev || (dev === bestDev && c.id < best)))) { best = c.id; bestD = d; bestDev = dev; }
  }
  return best;
};

/** Our city nearest the target tile (a city before an outpost; ties by id). */
export const pickStaging = (state, mine, targetTile) => {
  const tiles = getTiles();
  let best = null; let bestKey = Infinity;
  for (const m of mine) {
    const key = ringsApart(m.tile, targetTile, tiles) + (m.outpost ? 1000 : 0);
    if (key < bestKey - 1e-9 || (Math.abs(key - bestKey) <= 1e-9 && m.id < best.id)) { best = m; bestKey = key; }
  }
  return best ? best.id : null;
};

/**
 * The plan for this turn: kept when its target is still the enemy's (strike and cap refreshed),
 * made anew otherwise, or null when the nation is neither at war nor arming. `wars`: its active wars.
 */
export const updateWarPlan = (state, nationId, wars, ageId, { maxRings = Infinity } = {}) => {
  const nation = state.nations[nationId];
  if (!nation) return null;
  const enemies = new Set(wars.map((w) => (w.aggressor === nationId ? w.enemy : w.aggressor)));
  let goalIds = wars.map((w) => w.goal?.regionId).filter(Boolean);
  if (!enemies.size) {
    // Arming: the claim being made names the city and its owner (a claim that is ready leads to the
    // war itself within a few turns; one never used must not keep a nation arming for ever).
    const claimed = claimsInProgressOf(nation).map((c) => state.regions[c.cityId]).filter((c) => c && c.owner && c.owner !== nationId && !state.nations[c.owner]?.isEliminated);
    claimed.forEach((c) => enemies.add(c.owner));
    goalIds = claimed.map((c) => c.id);
    // A war decided and being armed for (warPrep, aiLogic.js processAIWarDecisions).
    const prep = prepLive(state, nationId) ? nation.warPrep.target : null;
    if (prep) enemies.add(prep);
    if (!enemies.size) return null;
  }
  const mine = ownCities(state, nationId);
  if (!mine.length) return null;
  const old = nation.warPlan;
  const unreachable = old?.unreachable || [];
  const keep = old && state.regions[old.cityId] && enemies.has(state.regions[old.cityId].owner) && state.regions[old.staging]?.owner === nationId && !unreachable.includes(old.cityId);
  const cityId = keep ? old.cityId : pickTargetCity(state, nationId, enemies, goalIds, mine, maxRings, unreachable);
  if (!cityId) return null;
  const city = state.regions[cityId];
  const staging = keep ? old.staging : pickStaging(state, mine, city.tile);
  if (!staging) return null;
  const strike = strikeSize(state, city, ageId);
  const land = landUnitsOf(state, nationId);
  const cap = armyCap(nation, mine.filter((c) => !c.outpost).length || 1, strike, land, unitUpkeepGold(state, { ageId, ownerId: nationId }));
  const siege = wallsOf(city) > 0 && getUnlockedClasses(ageId, getResearched(state, nationId)).includes('siege');
  const since = keep ? old.since : state.turnNumber;
  const plan = { enemy: city.owner, cityId, staging, strike, cap, siege, since, waves: keep ? (old.waves || 0) : 0, ...(unreachable.length ? { unreachable } : {}), ...(keep && old.near != null ? { near: old.near, nearTurn: old.nearTurn } : {}) };
  if (old && Object.keys(plan).every((k) => old[k] === plan[k])) return old;
  return plan;
};

// The interior-city guard (the lead's ruling of 14 October, on the user's behalf): when a war plan
// gathers regiments, a city may send ALL of its troops only when nothing hostile can reach it within
// SAFE_TURNS turns: no land unit of a nation it can fight (an enemy at war, rebels, an independent's
// warband or garrison) within SAFE_TURNS x that unit's march (armies.js MOVE_KM), and, for a coastal
// city, no hostile fleet within SAFE_TURNS x its sailing range (fleets.js NAVAL_KM_BY_AGE). Otherwise
// it keeps one regiment (aiOperations.js siegeParty), as border cities and the capital always do.
export const SAFE_TURNS = 3;

/** Hostile units that could reach a city of `nationId`: [{ tile, km }] (km = how far it goes in SAFE_TURNS). */
export const hostileReach = (state, nationId) => {
  const out = [];
  for (const u of Object.values(state.units || {})) {
    if (u.ownerId === nationId || !(u.strength > 0) || u.classId === 'settler' || u.tile == null || u.tile < 0 || u.embarkedOn) continue;
    if (!canFight(state, nationId, u.ownerId)) continue;
    if (u.domain === 'naval') out.push({ tile: u.tile, km: SAFE_TURNS * (NAVAL_KM_BY_AGE[state.nations[u.ownerId]?.tech?.ageId] || NAVAL_KM_BY_AGE.bronze), naval: true });
    else if (u.domain === 'land') out.push({ tile: u.tile, km: SAFE_TURNS * (MOVE_KM[u.classId] || DEFAULT_MOVE_KM) });
  }
  return out;
};

/** May this city of ours send every regiment away (see SAFE_TURNS)? `reach`: hostileReach(state, owner). */
export const interiorCitySafe = (city, reach, tiles = getTiles()) => {
  if (!city || city.tile == null) return false;
  const coastal = tiles.neighbors[city.tile].some((n) => tiles.land[n] !== 1);
  const km = kmPerRing(tiles);
  for (const r of reach) {
    if (r.naval && !coastal) continue;
    if (ringsApart(r.tile, city.tile, tiles) * km <= r.km) return false;
  }
  return true;
};

/** Units a stack at the staging city needs before it marches (see the header). */
export const goSize = (plan) => Math.max(GATHER_MIN_UNITS, Math.ceil(plan.strike * ((plan.waves || 0) > 0 ? WAVE_SHARE : GO_SHARE) - 1e-9));

/** May this many units march on the plan's target now? */
export const readyToStrike = (plan, units, turn) => units >= goSize(plan) || (turn - (plan.since || 0) >= GATHER_MAX_TURNS && units >= GATHER_MIN_UNITS);

/** The plan after its strike found no road to the target (an island, or beyond AI_MARCH_STEPS): the
 * next updateWarPlan picks another city. A muster used to wait at the staging city all war (lane ai-armies). */
export const dropTarget = (plan) => ({ ...plan, unreachable: [...(plan.unreachable || []), plan.cityId] });

// Strikes that arrive fed and do not stall (lane odds-truth P2; the math report of 29 Oct, section 7).
// A plan never leaves a target it can still take (updateWarPlan keeps it while it is the enemy's),
// which is stricter than the report's "switch only for a 15% better one". What it adds:
//   supply   a strike or siege party leaves only on a route where no meter empties on the way and
//            it holds STRIKE_SUPPLY_TURNS turns of supply at the target (supplyMeter.js
//            supplyAlongMarch); a target it cannot reach so is dropped like one with no road
//   progress a launched strike that comes no nearer its target (steps left on its route, plan.near
//            at plan.nearTurn) for REPLAN_REF_TURNS reference turns drops it, and its units stop
//   warning  a war on the player is declared only after the mustering line (warPrep) has shown for
//            PREP_VISIBLE_REF_TURNS reference turns, even when the muster is already full (ARM_SLACK)
export const STRIKE_SUPPLY_TURNS = 3;
export const REPLAN_REF_TURNS = 3;
export const PREP_VISIBLE_REF_TURNS = 2;

/** May a strike leave on a march with this supply forecast (supplyMeter.js supplyAlongMarch; null: it never loses supply)? */
export const supplyAllows = (m) => !m || (m.starvesAt == null && (m.turns == null || m.turns >= STRIKE_SUPPLY_TURNS));

/** The plan after a wave marched: the gathering clock restarts and later waves may be smaller. */
export const launched = (plan, turn) => ({ ...plan, waves: (plan.waves || 0) + 1, since: turn });

// Arming before a declaration (lane ai-armies; Civ VI's and Old World's AIs build up and move to the
// border before they declare). A Tier-1 AI that has decided on a war (aiLogic.js) keeps
// `nation.warPrep = { target, since }`: its plan arms (updateWarPlan above), recruits join the muster
// point, and it declares once the stack there can strike (its garrison left behind: goSize), or after
// WAR_PREP_REF_TURNS reference turns (speedTurns at its age) whatever it has. Declaring with the army
// scattered left 2-unit stacks at home for most of the war.
export const WAR_PREP_REF_TURNS = 8;
const prepTurns = (state, nationId, targetId) => speedTurns(WAR_PREP_REF_TURNS, state.gameSpeed, waitAgeOf(state, nationId, targetId));
/** Is the nation's warPrep still live: its target alive and fightable, and not left over (twice the
 * wait: a nation that dropped out of Tier 1 or became a vassal never declares, and must not arm for ever)? */
export const prepLive = (state, nationId) => {
  const prep = state.nations[nationId]?.warPrep;
  const target = prep && state.nations[prep.target];
  return !!target && !target.isEliminated && !exploreOn(state) && (state.turnNumber || 0) - prep.since < 2 * prepTurns(state, nationId, prep.target);
};
// The lead's call (option a, 29 Oct): a muster already within ARM_SLACK units of goSize declares at
// once. Arming every war delayed each by up to 8 turns and AI-vs-AI wars fell 8.4 to 6.0 a game.
export const ARM_SLACK = 2;
/** May the nation declare on targetId now: its muster (the stack at the staging city minus one
 * regiment of garrison) within ARM_SLACK of goSize, or the arming wait over? With no plan on the
 * target yet, the plan it would make (target city, staging, strike) is reckoned. */
export const armedFor = (state, nationId, targetId) => {
  const nation = state.nations[nationId];
  const prep = nation?.warPrep;
  if (prep?.target === targetId && (state.turnNumber || 0) - prep.since >= prepTurns(state, nationId, targetId)) return true;
  // The player sees the muster (the mustering line) for a while before the war, however ready it is.
  if (targetId === state.playerNationId && !(prep?.target === targetId && (state.turnNumber || 0) - prep.since >= speedTurns(PREP_VISIBLE_REF_TURNS, state.gameSpeed, waitAgeOf(state, nationId, targetId)))) return false;
  let plan = nation?.warPlan;
  if (!plan || plan.enemy !== targetId) {
    const mine = ownCities(state, nationId);
    const cityId = pickTargetCity(state, nationId, new Set([targetId]), [], mine);
    const staging = cityId && pickStaging(state, mine, state.regions[cityId].tile);
    if (!staging) return false;
    plan = { staging, strike: strikeSize(state, state.regions[cityId], ageOf(state, nationId)) };
  }
  const staging = state.regions[plan.staging];
  if (staging?.tile == null) return false;
  let there = 0;
  for (const u of Object.values(state.units || {})) if (u.ownerId === nationId && isLandArmy(u) && u.tile === staging.tile) there += 1;
  return there - 1 >= goSize(plan) - ARM_SLACK;
};
