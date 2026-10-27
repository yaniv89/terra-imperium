import { gameReducer } from './gameReducer';
import { getResearched, ageOf } from './nationState';
import { ActionTypes } from '../data/types';
import { msg, people, cityRef, place as placeRef, sub } from './messages';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { coloniesOf, colonySlots, foundColony, foundingCost, validateColony } from './colonies';
// Persistent front objectives and real, one-hop army orders. All combat uses invasion aftermath.
import { getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getPool, getTechAgeId } from './nationState';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, applyInvasionResult, validateAmphibious } from './invasion';
import { landingRecords } from './aiLanding';
import { isFortTile, fortOwnerOf } from './forts';
import { resolveAutoBattle } from './autoBattle';
import { fieldDefenseRecord } from './battleQueue';
import { isUnitInBattle } from './invasion';
import { placeInCity, unitTile, touchesCity, findTilePath, stackPace } from './armies';
import { advanceMarches } from './routes';
import { getTiles } from '../data/geo/tiles';
import { siegeMaxHp } from './sieges';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult } from './fieldBattle';
import { besiegersOf } from './sieges';
import { applyCosts, canAfford } from '../utils/helpers';
import { ACTION_COSTS } from '../data/actionCosts';
import { landUnitsByTile } from './sieges';
import { threatenedCities, besiegerStacksBeside, pillageTile } from './threat';
import { playerRouteTiles } from './plunder';
import { ringsAround } from './world/cities';
import { enemyFleetsAt, AI_FLEET_ATTACK_RATIO, validateFleetAttack } from './navalBattle';
import { estimateBattle } from './lanchester';
import { getTotalDev } from './development';
import { getDefenseLevelDamageReductionMultiplier, hasMeleeUnitDeployed } from './siege';
import { getCapital } from '../data/regions';
import { ringsForKm } from '../data/geo/gridScale';
import { isIndependentNation } from '../data/independents';
import { canAttack } from './hostility';
import { aiScout, marchScouts, scoutsThisTurn } from './aiScouting';
import { cityAttackStrength, cityAttackDamage, cityDefence } from './cityAssault';
import { cityMilitia, wallsHpRatio } from './battleInputs';
import { siegeHpOf } from './sieges';
import { updateWarPlan, readyToStrike, launched, hostileReach, interiorCitySafe, GATHER_MIN_UNITS } from './warPlans';

const routeStep = (regions, nationId, from, goals) => {
  const queue = [from], first = new Map([[from, null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id !== from && goals.has(id)) return first.get(id);
    for (const n of getNeighborIds(id)) {
      if (first.has(n) || regions[n]?.owner !== nationId || (regions[n].occupiedBy && regions[n].occupiedBy !== nationId)) continue;
      first.set(n, first.get(id) || n); queue.push(n);
    }
  }
  return null;
};

// Fronts on tiles (plans/civ-map-rework.md D6, workstream 9): an AI stack attacks a city only from
// tiles that touch its land; otherwise it marches on tiles toward its goal (the war-goal city, or
// the most valuable enemy city next door by the registry), halts before the city and besieges it
// (sieges.js); it assaults when it outweighs the garrison or the walls are under ASSAULT_HP.
export const ASSAULT_HP = 0.3;
export const AI_MARCH_KM = 4080; // km (40 rings at frequency 75)
export const AI_MARCH_STEPS = ringsForKm(AI_MARCH_KM);
export const ROUTE_RETRY_TURNS = 3;
export const AI_RAID_KM = 1122; // km (11 rings at frequency 75)
export const AI_RAID_RINGS = ringsForKm(AI_RAID_KM); // a stack at war with the player with no city goal in reach raids a trade route this close // a stack that found no path to its goal waits this long before searching again

// Battle decisions read the Lanchester estimate (lanchester.js: terrain, walls, forts, rivers,
// unit matchups and ages, calibrated against the real auto-resolve) instead of a raw strength
// ratio. An AI fights a battle when its estimated chance to win clears the bar:
//   SALLY_MIN_P    a besieged garrison sallies against the besiegers on one ring-1 tile
//   RELIEF_MIN_P   a stack beside a besieger of an own city attacks it (threat.js)
//   ASSAULT_MIN_P  a stack touching an enemy city assaults it (or the walls are under ASSAULT_HP)
//   LANDING_MIN_P  an embarked army lands on a defended coast
// SALLY_RATIO is the cheap pre-filter: a garrison under half the besiegers' strength never asks.
// Wars must fight (the user's rule of 14 October): the bars are low, an AI army at war prefers
// action, and FIGHT_FLOOR_P is the one floor under all of them, so it never throws itself at
// hopeless odds. A stack at war also seeks battle (FIELD_SEEK_MIN_P): an enemy army on a tile
// beside it is attacked.
export const FIGHT_FLOOR_P = 0.25;
export const SALLY_RATIO = 1.3;
export const SALLY_MIN_P = 0.5;
export const RELIEF_MIN_P = 0.4;
export const ASSAULT_MIN_P = 0.3;
export const FIELD_SEEK_MIN_P = 0.35;
export const LANDING_MIN_P = 0.4;
// An empty city (cityAssault.js) is attacked when one attack takes at least CITY_HIT_MIN_SHARE of
// its max HP (more than it heals in a turn), or enough to take it; else the stack besieges it first.
export const CITY_HIT_MIN_SHARE = 0.12;
const PREFILTER = 0.5;
const atLeast = (p, bar) => p >= Math.max(FIGHT_FLOOR_P, bar);
// A battle an AI starts against the player is not fought at once: it joins the battle queue
// (battleQueue.js) so the player chooses Command or Auto (master plan decision 24). The attackers
// spend their move now; a player stack already queued against is not attacked twice.
export const queueAgainstPlayer = (next, v, nationId, rng, kind = 'field') => {
  const busy = new Set((next.pendingDefenses || []).flatMap((d) => d.defenderUnitIds));
  if (v.defenderUnits.some((u) => busy.has(u.id))) return next;
  const record = fieldDefenseRecord(next, v, { aggressorId: nationId, seed: Math.floor(rng.next() * 0xffffffff) >>> 0, kind });
  const units = { ...next.units };
  v.attackerUnits.forEach((u) => { if (units[u.id]) units[u.id] = { ...units[u.id], movesLeft: 0 }; });
  return { ...next, units, pendingDefenses: [...(next.pendingDefenses || []), record] };
};
// I125: a garrison also strikes at a hostile stack camped beside its city before the siege has
// begun (an independent's city is usually assaulted the turn the campaign arrives, so it never sat
// under siege and never sallied). `byTile` (landUnitsByTile at the start of the phase) finds those
// cities cheaply; the besiegers themselves are read from the live state.
export const aiSally = (state, nationId, rng, byTile = null) => {
  let next = state;
  const tiles = getTiles();
  let liveIndex = null;
  const camped = (c) => c.tile != null && !!byTile && tiles.neighbors[c.tile].some((t) => (byTile.get(t) || []).some((u) => u.ownerId !== nationId));
  for (const city of getOwnedRegionIds(state.regions, nationId).map((id) => state.regions[id]).filter((c) => c.siege?.by || camped(c)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    // One index of the live units per units and regions map (a battle replaces them; nothing here writes in place).
    if (!liveIndex || liveIndex.units !== next.units || liveIndex.regions !== next.regions) liveIndex = { units: next.units, regions: next.regions, byTile: landUnitsByTile(next) };
    const by = besiegersOf(next, city, next.units, liveIndex.byTile);
    if (!by.size) continue;
    const garrison = Object.values(next.units).filter((u) => u.ownerId === nationId && u.regionId === city.id && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && (u.movesLeft ?? 1) > 0 && unitTile(next, u) === city.tile);
    if (!garrison.length) continue;
    const mine = garrison.reduce((s, u) => s + u.strength, 0);
    const targets = new Map();
    by.forEach((list) => list.forEach((u) => { const t = unitTile(next, u); targets.set(t, (targets.get(t) || 0) + u.strength); }));
    const weakest = [...targets].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    if (!weakest || mine < weakest[1] * PREFILTER) continue;
    const actor = { ...next, playerNationId: nationId, resources: getPool(next, nationId), techAgeId: getTechAgeId(next, nationId) };
    // `sally`: an independent, which starts no fight of its own, still strikes at its besiegers (I125).
    const v = validateFieldAttack(actor, city.id, weakest[0], { ignoreCost: true, sally: true });
    if (!v.ok) continue;
    const ctx = getFieldBattleContext(actor, v);
    if (estimateBattle(getFieldResolveArgs(v, ctx)).pWin < SALLY_MIN_P) continue;
    // Against the player: the battle waits in the queue for their Command or Auto (battleQueue.js).
    if (v.defenderNationId === state.playerNationId) { next = queueAgainstPlayer(next, v, nationId, rng); continue; }
    const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, rng);
    const r = applyFieldResult({ ...actor, units: next.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId, viewerId: state.playerNationId });
    // Sallies the AI fought (cumulative, for the balance harness; absent on old saves = 0).
    const st = next.indepStats || {};
    const indepStats = { ...st, sallies: (st.sallies || 0) + 1, salliesIndep: (st.salliesIndep || 0) + (isIndependentNation(next.nations[nationId]) ? 1 : 0), salliesWon: (st.salliesWon || 0) + (battle.outcome === 'attacker' ? 1 : 0) };
    next = { ...next, units: r.units, regions: r.regions, nations: { ...r.nations, [nationId]: { ...r.nations[nationId], economy: next.nations[nationId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || next.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport, indepStats,
      logs: [...next.logs, ...r.logs.slice(next.logs.length).filter(() => by.has(state.playerNationId))] };
  }
  return next;
};

// The log line when an AI stack pillages the land of a player's city (`tileName`: the tile's own name, if any).
const pillageLine = (state, nationId, cityId, tileName) => msg('m.battle.aiPillages', { nation: people(nationId, state.nations[nationId].name), city: cityRef(cityId, state.regions[cityId].name), place: tileName ? placeRef(tileName) : sub('m.battle.aTile') });

/** The nearest tile of the player's land trade routes within `rings` of `tile`, or null. */
export const nearestRouteTile = (state, tile, rings) => {
  const routes = playerRouteTiles(state);
  if (!routes.size) return null;
  const near = ringsAround(getTiles(), tile, rings);
  let best = null; let bestD = Infinity;
  routes.forEach((t) => { const d = near.get(t); if (d !== undefined && (d < bestD || (d === bestD && t < best))) { best = t; bestD = d; } });
  return best;
};

// Which enemy city next door a stack goes for (plans/math-ideas.md 3.1, utility scoring): every
// candidate is scored, best first (ties by id):
//   utility = worth x claim x goal x capital x (TARGET_P_FLOOR + pWin)
//   worth   the city's development (at least 1), so rich cities draw armies
//   claim   TARGET_CLAIM_MULT for a city this nation lost (formerOwner, a conquest from it)
//   goal    TARGET_GOAL_MULT for the city its war is about
//   capital TARGET_CAPITAL_MULT for the enemy's capital
//   pWin    the Lanchester estimate of this stack against the garrison behind its walls
// It used to rank by a fixed list (former owner, then goal, then the weakest garrison).
export const TARGET_CLAIM_MULT = 3;
export const TARGET_GOAL_MULT = 2;
export const TARGET_CAPITAL_MULT = 1.5;
export const TARGET_P_FLOOR = 0.1; // a strong garrison lowers a city's draw, it never hides it
export const targetUtility = (state, nationId, wars, stack, id, garrison) => {
  const city = state.regions[id];
  const claim = city.formerOwner === nationId || city.conquest?.from === nationId ? TARGET_CLAIM_MULT : 1;
  const goal = wars.some(w => w.goal?.regionId === id) ? TARGET_GOAL_MULT : 1;
  const capital = getCapital(state, city.owner) === id ? TARGET_CAPITAL_MULT : 1;
  const walls = getDefenseLevelDamageReductionMultiplier(city.defenseLevel || 0);
  const pWin = garrison.length ? estimateBattle({ attackerUnits: stack, defenderUnits: garrison, isAttackingFortification: (city.defenseLevel || 0) > 0, defenderDamageReductionMultiplier: walls }).pWin : 1;
  return Math.max(1, getTotalDev(city)) * claim * goal * capital * (TARGET_P_FLOOR + pWin);
};
const rankTargets = (state, nationId, wars, stack, ids, unitsIn) => {
  const score = new Map(ids.map(id => [id, targetUtility(state, nationId, wars, stack, id, unitsIn(id).filter(u => u.ownerId !== nationId && u.domain === 'land'))]));
  return ids.sort((a, b) => score.get(b) - score.get(a) || a.localeCompare(b));
};

/** A halted march attacks the army blocking its next tile (CB09 I120) when the estimate clears
 * ASSAULT_MIN_P: against the player the battle is queued (Command or Auto). Returns the new state,
 * or null when it does not attack. */
export const attackBlocker = (state, nationId, from, stack, tile, rng) => {
  if (tile == null) return null;
  const actor = { ...state, playerNationId: nationId, resources: getPool(state, nationId), techAgeId: getTechAgeId(state, nationId) };
  const v = validateFieldAttack(actor, from, tile, { ignoreCost: true });
  if (!v.ok || !v.attackerUnits.some((u) => stack.some((s) => s.id === u.id))) return null;
  const ctx = getFieldBattleContext(actor, v);
  if (estimateBattle(getFieldResolveArgs(v, ctx)).pWin < ASSAULT_MIN_P) return null;
  if (v.defenderNationId === state.playerNationId) return queueAgainstPlayer(state, v, nationId, rng);
  const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, rng);
  const r = applyFieldResult({ ...actor, units: state.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId, viewerId: state.playerNationId });
  return { ...state, units: r.units, regions: r.regions, nations: { ...r.nations, [nationId]: { ...r.nations[nationId], economy: state.nations[nationId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || state.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport, logs: state.logs };
};

/**
 * Seek battle (the user's rule of 14 October: wars must fight): a stack at war attacks the enemy
 * army on a tile beside it (not a city centre: a garrison is an assault) with the best odds, when
 * the estimate clears FIELD_SEEK_MIN_P. Against the player the battle is queued (Command or Auto).
 * Returns the new state, or null when it does not attack.
 */
export const seekFieldBattle = (state, nationId, from, stack, at, enemies, rng, index = null) => {
  if (at == null) return null;
  const tiles = getTiles();
  const centres = index?.centres || new Set(Object.values(state.regions).map((c) => c.tile));
  const byTile = index?.byTile || landUnitsByTile(state);
  const actor = { ...state, playerNationId: nationId, resources: getPool(state, nationId), techAgeId: getTechAgeId(state, nationId) };
  let best = null;
  for (const t of tiles.neighbors[at]) {
    if (centres.has(t) || !(byTile.get(t) || []).some((u) => enemies.has(u.ownerId) && !isUnitInBattle(state, u.id))) continue;
    const v = validateFieldAttack(actor, from, t, { ignoreCost: true });
    if (!v.ok || !v.attackerUnits.some((u) => stack.some((s) => s.id === u.id))) continue;
    const ctx = getFieldBattleContext(actor, v);
    const p = estimateBattle(getFieldResolveArgs(v, ctx)).pWin;
    if (atLeast(p, FIELD_SEEK_MIN_P) && (!best || p > best.p || (p === best.p && t < best.t))) best = { v, ctx, p, t };
  }
  if (!best) return null;
  const { v, ctx } = best;
  if (v.defenderNationId === state.playerNationId) return queueAgainstPlayer(state, v, nationId, rng);
  const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, rng);
  const r = applyFieldResult({ ...actor, units: state.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId, viewerId: state.playerNationId });
  return { ...state, units: r.units, regions: r.regions, nations: { ...r.nations, [nationId]: { ...r.nations[nationId], economy: state.nations[nationId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || state.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport, logs: state.logs };
};

/** Is an empty enemy city worth an attack by this stack now (cityAssault.js)? One attack must take
 * CITY_HIT_MIN_SHARE of its max HP, or what HP it has left. */
export const cityAttackWorthIt = (state, nationId, stack, city) => {
  // Walls already at 0 HP and nobody to walk in: another attack only repeats the same battle (playtest 4 M2). The siege holds.
  if (siegeHpOf(city, state.greatProjects) <= 0 && !hasMeleeUnitDeployed(stack.filter((u) => u.strength > 0))) return false;
  const attack = cityAttackStrength(stack, { attackerAgeId: getTechAgeId(state, nationId), defenderAgeId: getTechAgeId(state, city.owner) });
  const hit = cityAttackDamage(attack, cityDefence(city, { militia: cityMilitia(state, city.id), hpRatio: wallsHpRatio(state, city) }));
  return hit >= CITY_HIT_MIN_SHARE * siegeMaxHp(city, state.greatProjects) || hit >= siegeHpOf(city, state.greatProjects);
};

/** The units of a stack that march out to lay siege (CB09 I120): all of them, except that a stack
 * standing in one of its own cities leaves its weakest unit behind as the garrison. */
export const siegeParty = (state, stack, at, fromCityId) => {
  const inOwnCity = state.regions[fromCityId]?.tile === at && state.regions[fromCityId]?.owner === stack[0]?.ownerId;
  if (!inOwnCity) return stack;
  if (stack.length < 2) return [];
  // A siege engine never stays home as the garrison: the walls are what it is for. Nor does the
  // party's only human beside robots: robots cannot hold what they take (robots.js, U72).
  const lone = stack.filter((u) => !u.robot).length === 1 && stack.some((u) => u.robot);
  const keep = [...stack].sort((a, b) => (a.classId === 'siege') - (b.classId === 'siege') || (lone && !a.robot) - (lone && !b.robot) || (a.strength || 0) - (b.strength || 0) || (a.id < b.id ? -1 : 1))[0];
  return stack.filter((u) => u !== keep);
};

// --- War plans (warPlans.js, lane W5): gathering at the muster point --------------------------

// A party marches before the strike is full when it already beats the target's garrison behind its
// walls (the Lanchester estimate, as targetUtility reads it) with STRIKE_WIN_P, or the city stands
// empty. Waiting for a full strike against a city it can already take only made wars drag on
// (lane W6: mean war length 19 turns with plans against 11 without, and half the captures).
export const STRIKE_WIN_P = 0.5;
export const strikeWinsNow = (state, nationId, party, city) => {
  if (!city || city.tile == null || party.length < GATHER_MIN_UNITS) return false;
  const garrison = Object.values(state.units).filter((u) => u.ownerId === city.owner && u.regionId === city.id && u.domain === 'land' && u.classId !== 'settler' && u.strength > 0 && (u.tile == null || u.tile === city.tile));
  if (!garrison.length) return true;
  const walls = getDefenseLevelDamageReductionMultiplier(city.defenseLevel || 0);
  return estimateBattle({ attackerUnits: party, defenderUnits: garrison, isAttackingFortification: (city.defenseLevel || 0) > 0, defenderDamageReductionMultiplier: walls }).pWin >= STRIKE_WIN_P;
};

/** Writes the plan on the working copy's nation (next.nations is replaced, never mutated). */
const savePlan = (next, nationId, plan) => {
  next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], warPlan: plan } };
  return plan;
};

/** Do units of ours already stand beside this city (a siege a new party may join)? */
export const besiegedByUs = (state, nationId, city, byTile) => {
  if (city?.tile == null) return false;
  return getTiles().neighbors[city.tile].some((t) => (byTile.get(t) || []).some((u) => u.ownerId === nationId));
};

/**
 * Sends a stack toward the plan's muster point (the staging city): all of it from the field or
 * from an interior city, all but the weakest from a border city or the capital (`keepGarrison`,
 * siegeParty). Writes routes into `next.units` (a
 * working copy). Returns true when a party is on the road.
 */
export const gatherStack = (next, nationId, plan, stack, at, from, committed, keepGarrison = true) => {
  const staging = next.regions[plan.staging];
  if (!staging || staging.tile == null || at == null || at === staging.tile) return false;
  const goers = keepGarrison ? siegeParty(next, stack, at, from) : stack;
  if (!goers.length) return false;
  const goalKey = `stage:${plan.staging}`;
  const failed = stack[0].routeFailed;
  if (failed && failed.goal === goalKey && failed.until > (next.turnNumber || 0)) return false;
  const researched = getResearched(next, nationId);
  const path = findTilePath({ ...next, playerNationId: nationId }, at, staging.tile, nationId, { maxSteps: AI_MARCH_STEPS, researched });
  if (!path.path) { stack.forEach((u) => { if (next.units[u.id]) next.units[u.id] = { ...next.units[u.id], routeFailed: { goal: goalKey, until: (next.turnNumber || 0) + ROUTE_RETRY_TURNS } }; }); return false; }
  const pace = stackPace(goers, researched);
  goers.forEach((u) => { if (!next.units[u.id]) return; committed.add(u.id); next.units[u.id] = { ...next.units[u.id], route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
  return true;
};

/** Arming at peace (a claim in the making): spare regiments of every city gather at the muster point. */
export const gatherForPlan = (state, nationId, plan, committed) => {
  const next = { ...state, units: { ...state.units } };
  const stacks = new Map();
  for (const u of Object.values(next.units)) {
    if (u.ownerId !== nationId || u.domain !== 'land' || u.classId === 'settler' || u.classId === 'air' || u.embarkedOn || !(u.strength > 0) || u.indepOp || u.scout || u.route?.length || committed.has(u.id) || isUnitInBattle(next, u.id)) continue;
    const key = `${u.regionId}|${unitTile(next, u)}`;
    const l = stacks.get(key); if (l) l.push(u); else stacks.set(key, [u]);
  }
  // Parties still on the road from earlier turns walk too (marchedThisTurn in routes.js keeps a
  // scout that already walked this turn from walking twice).
  let marching = Object.values(next.units).some((u) => u.ownerId === nationId && u.route?.length && !u.scout);
  for (const [key, stack] of [...stacks].sort(([a], [b]) => a.localeCompare(b))) {
    const from = key.split('|')[0];
    if (next.regions[from]?.owner !== nationId) continue;
    if (gatherStack(next, nationId, plan, stack, unitTile(next, stack[0]), from, committed)) marching = true; // at peace every city keeps its garrison
  }
  return marching ? marchAiArmies(next, nationId) : state;
};

export const processAIOperations = (state, rng) => {
  let next = { ...state, units: { ...state.units }, aiOperations: {}, pendingDefenses: [...(state.pendingDefenses || [])] };
  const committed = new Set();
  let unitsByRegion = null; let unitsByRegionFor = null;
  const raidTiles = raidPartyTiles(state);
  const sallyIndex = landUnitsByTile(state); // where foreign stacks stand at the start of the phase (aiSally)
  // Who has a scout out: only aiScout makes one, in its own nation's step, so a nation outside this
  // set with no scouting turn has nothing for aiScout to do (it skips the walk of every unit).
  const scouting = new Set();
  for (const id in state.units) if (state.units[id].scout) scouting.add(state.units[id].ownerId);
  for (const nationId of Object.keys(state.nations).sort()) {
    if (nationId === state.playerNationId || state.nations[nationId].isEliminated) continue;
    if (state.scenario?.mode === 'emergent') {
      const neutral = [...new Set(getOwnedRegionIds(next.regions, nationId).flatMap(getNeighborIds))].filter(id => next.regions[id]?.owner === null).sort();
      // Colonies (colonies.js), under the same rules as the player: a free slot first, then the
      // first affordable target. Wary of strong natives: live alongside them; else drive them out.
      if (coloniesOf(next, nationId).length < colonySlots(next, nationId) && canAfford(getPool(next, nationId), foundingCost(next, nationId))) {
        const target = neutral.find(id => !next.regions[id].colony && validateColony(next,id,nationId,{quick:true}).ok);
        if(target) next=foundColony(next,target,(next.regions[target].neutral?.resistance||0)>=45?'coexist':'driveOut',nationId);
      }
    }
    // Phase W3: raiders on its land are hunted, and a campaign against an independent marches,
    // besieges and assaults (indepPolicy.js tags the siege force).
    if (!isIndependentNation(next.nations[nationId])) {
      if (raidTiles.size) next = aiHuntRaiders(next, nationId, raidTiles, rng);
      if (next.nations[nationId]?.indepGoal?.kind === 'conquer') next = processIndependentOps(next, nationId, rng);
    }
    const wars = next.wars.filter(w => w.active && (w.aggressor === nationId || w.enemy === nationId));
    // The war plan (warPlans.js, lane W5): the city to take, the muster point, the strike size and
    // the army to train. Kept on the nation; dropped when it is neither at war nor arming.
    let plan = null;
    if (!isIndependentNation(next.nations[nationId])) {
      plan = updateWarPlan(next, nationId, wars, getTechAgeId(next, nationId), { maxRings: AI_MARCH_STEPS });
      if (plan !== (next.nations[nationId].warPlan ?? null)) next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], warPlan: plan || undefined } };
    }
    // A besieged garrison sallies when it can win (I125), at war or not: an independent besieged by a
    // major's campaign (no war needed, hostility.js) or a city besieged by rebels used to sit still.
    next = aiSally(next, nationId, rng, sallyIndex);
    // At peace a major scouts (aiScouting.js, CB09 I122): one unit at a time explores and makes contact.
    if (!wars.length) {
      if (!isIndependentNation(next.nations[nationId]) && (scouting.has(nationId) || scoutsThisTurn(nationId, next.turnNumber || 0)) && aiScout(next, nationId)) marchScouts(next, nationId);
      // Arming for a war (a claim in the making): spare regiments gather at the muster point.
      if (plan) next = gatherForPlan(next, nationId, plan, committed);
      continue;
    }
    const enemies = new Set(wars.map(w => w.aggressor === nationId ? w.enemy : w.aggressor));
    const land = getOwnedRegionIds(next.regions, nationId);
    const fronts = new Set(land.filter(id => getNeighborIds(id).some(n => enemies.has(next.regions[n]?.owner))));
    // Threatened cities (threat.js): besieged, under invasion, or enemy strength within 4 tiles
    // over the garrison; the AI defends them before it advances.
    const byTile = landUnitsByTile(next);
    const byTileOf = { units: next.units, regions: next.regions };
    let fieldIndex = null;
    const threatened = new Set(threatenedCities(next, nationId, enemies, byTile));
    const goals = threatened.size ? threatened : fronts;
    next.aiOperations[nationId] = { turn: state.turnNumber, objective: threatened.size ? 'defend' : 'advance', startedTurn:state.aiOperations?.[nationId]?.objective === (threatened.size ? 'defend' : 'advance') ? state.aiOperations[nationId].startedTurn : state.turnNumber, fronts: [...fronts].sort(), targets: [...goals].sort() };
    const tiles = getTiles();
    const stacks = new Map();
    for (const u of Object.values(next.units)) {
      if (u.ownerId !== nationId || u.domain !== 'land' || u.classId === 'settler' || u.classId === 'air' || u.embarkedOn || u.strength <= 0 || u.indepOp || isUnitInBattle(next, u.id)) continue;
      // Stacks by tile: an army on the road stands apart from the garrison of its base.
      const key = `${u.regionId}|${unitTile(next, u)}`;
      const stack = stacks.get(key) || []; stack.push(u); stacks.set(key, stack);
    }
    // Which city keeps one regiment when the plan gathers (warPlans.js interiorCitySafe): a border
    // city, the capital, and any city something hostile could reach within SAFE_TURNS turns.
    let reach = null;
    const keepsGarrison = (from) => {
      if (fronts.has(from) || from === getCapital(next, nationId)) return true;
      if (!reach) reach = hostileReach(next, nationId);
      return !interiorCitySafe(next.regions[from], reach);
    };
    let marching = false;
    for (const [key, seen] of [...stacks].sort(([a], [b]) => a.localeCompare(b))) {
      // A battle earlier in this loop can have hit this stack: read it fresh, the dead left out.
      const stack = seen.map((u) => next.units[u.id]).filter(Boolean);
      if (!stack.length) continue;
      const from = key.split('|')[0];
      if (!stack.every(u => u.movesLeft > 0 && !committed.has(u.id)) || next.regions[from]?.owner !== nationId) continue;
      // A march halted by an enemy army on its next tile (routes.js 'enemy') attacks it when the
      // estimate gives it ASSAULT_MIN_P; two stacks used to stand face to face for the whole war (CB09 I120).
      if (stack.some(u => u.route?.length) && stack.every(u => u.routeHalt === 'enemy')) {
        const r = attackBlocker(next, nationId, from, stack, stack.find(u => u.route?.length).route[0], rng);
        if (r) { next = r; stack.forEach(u => committed.add(u.id)); continue; }
      }
      // A march halted before its target city (routes.js 'attack': the next step is the city) is at
      // the walls: it drops the last step and decides here like any stack beside the city (assault,
      // or hold the tile and keep the siege on). It used to keep the step and wait there all war,
      // battering the walls to 0 HP and never fighting the garrison (lane W5).
      if (stack.some(u => u.route?.length) && stack.every(u => !u.route?.length || u.routeHalt === 'attack')) {
        stack.forEach((u, i) => { if (u.route && next.units[u.id]) { next.units[u.id] = { ...next.units[u.id], route: null, routeHalt: null, routeBank: 0 }; stack[i] = next.units[u.id]; } });
      }
      if (stack.some(u => u.route?.length)) { marching = true; continue; } // already on the road: the march phase below walks it
      const pool = getPool(next, nationId);
      const at = unitTile(next, stack[0]);
      // A garrison holds its own fort (forts.js: a manned fort stops the enemy) while the enemy stands
      // at its gates, or while no city of its needs it.
      if (isFortTile(next, at) && fortOwnerOf(next, at) === nationId && (!threatened.size || tiles.neighbors[at].some((n) => (byTile.get(n) || []).some((u) => enemies.has(u.ownerId))))) continue;
      // Relief (threat.js): a stack beside a besieger of an own city attacks it when the estimate
      // gives it RELIEF_MIN_P against that besieger stack.
      const besiegedNear = land.map(id => next.regions[id]).filter(c => c.siege?.by && tiles.neighbors[c.tile].some(t => t === at || tiles.neighbors[at].includes(t)));
      let relieved = false;
      for (const city of besiegedNear) {
        const weakest = besiegerStacksBeside(next, at, city, byTile)[0];
        if (!weakest || stack.reduce((s, u) => s + u.strength, 0) < weakest.strength * PREFILTER) continue;
        const actor = { ...next, playerNationId: nationId, resources: pool, techAgeId: getTechAgeId(next, nationId) };
        const v = validateFieldAttack(actor, from, weakest.tile, { ignoreCost: true });
        if (!v.ok) continue;
        const ctx = getFieldBattleContext(actor, v);
        if (estimateBattle(getFieldResolveArgs(v, ctx)).pWin < RELIEF_MIN_P) continue;
        if (v.defenderNationId === state.playerNationId) {
          next = queueAgainstPlayer(next, v, nationId, rng);
          stack.forEach(u => committed.add(u.id));
          relieved = true;
          break;
        }
        const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, rng);
        const r = applyFieldResult({ ...actor, units: next.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId, viewerId: state.playerNationId });
        stack.forEach(u => committed.add(u.id));
        next = { ...next, units: r.units, regions: r.regions, nations: { ...r.nations, [nationId]: { ...r.nations[nationId], economy: next.nations[nationId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || next.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport,
          logs: [...next.logs, ...r.logs.slice(next.logs.length).filter(() => v.defenderNationId === state.playerNationId)] };
        relieved = true;
        break;
      }
      if (relieved) continue;
      // Seek battle: an enemy army beside this stack is attacked when the odds allow.
      // The enemy stacks by tile for seekFieldBattle, rebuilt only when a battle replaced the units
      // or the regions map: what this nation writes in place moves only its own units, never an enemy.
      if (!fieldIndex || fieldIndex.units !== next.units || fieldIndex.regions !== next.regions) {
        const fresh = next.units === byTileOf.units && next.regions === byTileOf.regions;
        const centres = fieldIndex?.regions === next.regions ? fieldIndex.centres : new Set(Object.values(next.regions).map((c) => c.tile));
        fieldIndex = { units: next.units, regions: next.regions, byTile: fresh ? byTile : landUnitsByTile(next), centres };
      }
      const sought = seekFieldBattle(next, nationId, from, stack, at, enemies, rng, fieldIndex);
      if (sought) { next = sought; stack.forEach(u => committed.add(u.id)); continue; }
      // Units by region, rebuilt only when a battle replaced the units map (the scan per enemy
      // neighbour per stack was most of the phase at a thousand units).
      if (unitsByRegionFor !== next.units) { unitsByRegion = new Map(); Object.values(next.units).forEach(u => { const l = unitsByRegion.get(u.regionId); if (l) l.push(u); else unitsByRegion.set(u.regionId, [u]); }); unitsByRegionFor = next.units; }
      const unitsIn = (id) => unitsByRegion.get(id) || [];
      // The cities next to the stack's base, and those whose land the stack stands on or beside: a
      // stack that marched to besiege a far city assaults it from there (with sieges that never
      // take a city, it used to sit at the walls for the whole war).
      const near = new Set(getNeighborIds(from));
      if (at != null) [at, ...tiles.neighbors[at]].forEach((t) => { const id = next.world?.tileOwner?.[t]; if (id != null && id !== from) near.add(id); });
      const ranked = rankTargets(next, nationId, wars, stack, [...near].sort().filter(id => enemies.has(next.regions[id]?.owner) && !next.pendingDefenses.some(d=>d.regionId===id) && !unitsIn(id).some(u=>isUnitInBattle(next,u.id))), unitsIn);
      // Attacks come from tiles that touch the city's land; a city farther off is marched on.
      const candidates = ranked.filter(id => touchesCity(next, tiles, at, id));
      const target = threatened.size && !threatened.has(from) ? null : candidates[0];
      if (target) {
        const actor = { ...next, playerNationId: nationId, resources: pool, techAgeId: getTechAgeId(next, nationId) };
        const v = validateInvasion(actor, from, target);
        if (!v.ok) continue;
        const city = next.regions[target];
        const wallsDown = !!city.siege && city.siege.hp < ASSAULT_HP * siegeMaxHp(city, next.greatProjects);
        const ctx = getInvasionBattleContext(actor, v);
        // Not worth an assault yet. A garrison is assaulted at ASSAULT_MIN_P (at the floor once the
        // walls are down); an empty city (cityAssault.js) when one attack does real damage. A stack
        // already beside the city (ring 1) holds its tile, which keeps the siege on (sieges.js). One
        // that only touches the city's land from its own city used to wait there forever (CB09 I120:
        // 30 Kanesh units piled in a colony beside Waset and never fought): it marches to the walls
        // and lays siege instead, leaving one unit at home.
        const notYet = v.defenderUnits.length
          ? !atLeast(estimateBattle(getResolveBattleArgs(v, ctx)).pWin, wallsDown ? FIGHT_FLOOR_P : ASSAULT_MIN_P)
          : !cityAttackWorthIt(next, nationId, v.attackerUnits, city);
        if (notYet) {
          if (city.tile != null && at !== city.tile && !tiles.neighbors[city.tile].includes(at)) {
            const goers = siegeParty(next, stack, at, from);
            // A war plan (warPlans.js): a party too small to strike gathers at the muster point
            // instead of walking to the walls alone; one joining a siege of ours already there goes.
            const joining = besiegedByUs(next, nationId, city, byTile);
            // (Under threat the stack holds its own city instead of gathering.)
            if (plan && !joining && !readyToStrike(plan, goers.length, state.turnNumber) && !strikeWinsNow(next, nationId, goers, city)) {
              if (!threatened.size && gatherStack(next, nationId, plan, stack, at, from, committed, keepsGarrison(from))) marching = true;
              continue;
            }
            const failed = stack[0].routeFailed;
            if (goers.length && !(failed && failed.goal === `siege:${target}` && failed.until > state.turnNumber)) {
              const path = findTilePath({ ...next, playerNationId: nationId }, at, city.tile, nationId, { maxSteps: AI_MARCH_STEPS, researched: getResearched(state, nationId) });
              if (path.path) {
                const pace = stackPace(goers, getResearched(state, nationId));
                goers.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
                marching = true;
                if (plan && !joining) plan = savePlan(next, nationId, launched(plan, state.turnNumber));
              } else stack.forEach(u => { next.units[u.id] = { ...u, routeFailed: { goal: `siege:${target}`, until: state.turnNumber + ROUTE_RETRY_TURNS } }; });
            }
          }
          continue;
        }
        // Keep a defensive reserve when the capital is under siege elsewhere.
        stack.forEach(u => committed.add(u.id));
        const chargedPool = applyCosts(pool, ACTION_COSTS.launchInvasion);
        if (next.regions[target].owner === state.playerNationId) {
          next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], economy: chargedPool } };
          stack.forEach(u => { next.units[u.id] = { ...u, movesLeft: 0 }; });
          next.pendingDefenses.push({ id: `op_${state.turnNumber}_${nationId}_${from}`, warId: v.war.id, aggressorId: nationId, fromRegionId: from, regionId: target, attackerUnitIds: stack.map(u => u.id), defenderUnitIds: v.defenderUnits.map(u=>u.id), synthetic: [], seed: Math.floor(rng.next()*0xffffffff)>>>0, turn: state.turnNumber });
        } else {
          const battle = resolveAutoBattle(actor, getResolveBattleArgs(v, ctx), { kind: 'invasion', cityId: target, fromRegionId: from }, rng);
          const result = applyInvasionResult(actor, { ...v, fromRegionId: from, targetRegionId: target, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed(), viewerId: state.playerNationId, militia: battle.inputs.militia });
          next = { ...next, regions: result.regions, units: result.units, wars: result.wars, hiredCommanders: result.hiredCommanders, appliedBattleIds: result.appliedBattleIds, world: result.world || next.world,
            nations: { ...result.nations, [nationId]: { ...result.nations[nationId], economy: chargedPool } },
            logs: [...next.logs, { year: next.year, type: 'combat', ...msg('m.battle.aiAttacksFrom', { nation: people(nationId, next.nations[nationId].name), from: cityRef(from, next.regions[from]?.name || state.regions[from]?.name || from), to: cityRef(target, state.regions[target]?.name || next.regions[target]?.name || target) }) }] };
        }
      } else {
        // A war plan (warPlans.js, lane W5): regiments gather at the muster point and march on the
        // target city as one strike stack (later waves when the first is spent). Under threat the
        // stack in a threatened city of ours is its own muster point: it holds, and strikes out
        // (leaving its garrison) only once it is a strike stack; stacks elsewhere go to defend.
        const inCity = next.regions[from]?.tile === at;
        const holding = threatened.size > 0;
        if (plan && (!holding || (threatened.has(from) && inCity)) && next.regions[plan.cityId]?.tile != null) {
          const staging = next.regions[plan.staging];
          const atMuster = holding || at === staging?.tile;
          if (atMuster || !inCity) {
            const goers = atMuster ? siegeParty(next, stack, at, from) : stack;
            if (goers.length && (readyToStrike(plan, goers.length, state.turnNumber) || strikeWinsNow(next, nationId, goers, next.regions[plan.cityId]))) {
              const failed = stack[0].routeFailed;
              const goalKey = `plan:${plan.cityId}`;
              if (failed && failed.goal === goalKey && failed.until > state.turnNumber) continue;
              const path = findTilePath({ ...next, playerNationId: nationId }, at, next.regions[plan.cityId].tile, nationId, { maxSteps: AI_MARCH_STEPS, researched: getResearched(state, nationId) });
              if (!path.path) { stack.forEach(u => { next.units[u.id] = { ...u, routeFailed: { goal: goalKey, until: state.turnNumber + ROUTE_RETRY_TURNS } }; }); continue; }
              const pace = stackPace(goers, getResearched(state, nationId));
              goers.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
              marching = true;
              plan = savePlan(next, nationId, launched(plan, state.turnNumber));
              continue;
            }
            if (atMuster) continue; // gathering: wait for the rest
            // A small party in the field pillages where it stands, or raids the player's trade
            // routes near it (plunder.js), else falls back to the muster point.
            const raid = pillageTile(next, nationId, at, enemies);
            if (raid) {
              stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, movesLeft: 0 }; });
              next = { ...next, world: { ...next.world, tileState: raid.tileState }, nations: { ...next.nations, [nationId]: { ...next.nations[nationId], economy: { ...pool, gold: (pool.gold || 0) + raid.gold } } },
                logs: next.regions[raid.cityId]?.owner === state.playerNationId ? [...next.logs, { year: next.year, type: 'combat', ...pillageLine(next, nationId, raid.cityId, tiles.names[at]) }] : next.logs };
              continue;
            }
            if (enemies.has(state.playerNationId)) {
              const routeTile = nearestRouteTile(next, at, AI_RAID_RINGS);
              if (routeTile === at) continue; // standing on the route cuts it
              const failed = stack[0].routeFailed;
              const goalKey = `raid:${routeTile}`;
              if (routeTile != null && !(failed && failed.goal === goalKey && failed.until > state.turnNumber)) {
                const path = findTilePath({ ...next, playerNationId: nationId }, at, routeTile, nationId, { maxSteps: AI_MARCH_STEPS, researched: getResearched(state, nationId) });
                if (path.path) {
                  const pace = stackPace(stack, getResearched(state, nationId));
                  stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
                  marching = true;
                  continue;
                }
                stack.forEach(u => { next.units[u.id] = { ...u, routeFailed: { goal: goalKey, until: state.turnNumber + ROUTE_RETRY_TURNS } }; });
              }
            }
          }
          if (!holding && gatherStack(next, nationId, plan, stack, at, from, committed, keepsGarrison(from))) marching = true;
          continue;
        }
        // A stack already at a goal city stays on it and marches on tiles below; hopping on to the
        // next goal city made stacks shuttle between two fronts for whole wars (CB09 I120, X22).
        const to = goals.has(from) ? null : routeStep(next.regions, nationId, from, goals);
        if (to && canAfford(pool, ACTION_COSTS.moveArmy)) {
          stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...placeInCity(u, next.regions, to), movesLeft: 0 }; });
          next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], economy: applyCosts(pool, ACTION_COSTS.moveArmy) } };
          continue;
        }
        // At the front with no city in reach: march on tiles toward the goal and lay siege.
        if (threatened.size && !threatened.has(from)) continue;
        const goal = wars.map(w => w.goal?.regionId).find(id => id && enemies.has(next.regions[id]?.owner)) || ranked[0];
        // A raid (threat.js): halted on an enemy tile with an improvement, the stack pillages it.
        const raid = pillageTile(next, nationId, at, enemies);
        if (raid) {
          stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, movesLeft: 0 }; });
          next = { ...next, world: { ...next.world, tileState: raid.tileState }, nations: { ...next.nations, [nationId]: { ...next.nations[nationId], economy: { ...pool, gold: (pool.gold || 0) + raid.gold } } },
            logs: next.regions[raid.cityId]?.owner === state.playerNationId ? [...next.logs, { year: next.year, type: 'combat', ...pillageLine(next, nationId, raid.cityId, tiles.names[at]) }] : next.logs };
          continue;
        }
        const actor = { ...next, playerNationId: nationId };
        const failed = stack[0].routeFailed;
        // A city goal first; with none in reach and the player among the enemies, the nearest tile
        // of the player's trade routes (plunder.js): standing on it cuts and plunders the route.
        let target = goal && next.regions[goal]?.tile != null ? next.regions[goal].tile : null;
        let goalKey = goal || null;
        if ((!target || (failed && failed.goal === goal && failed.until > state.turnNumber)) && enemies.has(state.playerNationId)) {
          const raid = nearestRouteTile(next, at, AI_RAID_RINGS);
          if (raid != null && raid !== at) { target = raid; goalKey = `raid:${raid}`; }
        }
        if (target == null) continue;
        if (failed && failed.goal === goalKey && failed.until > state.turnNumber) continue; // searched lately, nothing found
        // planned with the nation's own techs (roads, bridges, mountain craft), as its march will pay
        const path = findTilePath(actor, at, target, nationId, { maxSteps: AI_MARCH_STEPS, researched: getResearched(state, nationId) });
        if (!path.path) { stack.forEach(u => { next.units[u.id] = { ...u, routeFailed: { goal: goalKey, until: state.turnNumber + ROUTE_RETRY_TURNS } }; }); continue; }
        const pace = stackPace(stack, getResearched(state, nationId));
        stack.forEach(u => { committed.add(u.id); next.units[u.id] = { ...u, route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
        marching = true;
      }
    }
    if (marching) next = marchAiArmies(next, nationId);
  }
  return processAINavalOperations({...next,rngSeed:rng.getSeed()});
};

// Walks every AI army on a route (routes.js advanceMarches with the nation as the actor). Called
// once per nation at war from processAIOperations.
const marchAiArmies = (next, nationId) => {
  const actor = { ...next, playerNationId: nationId };
  const units = { ...next.units };
  advanceMarches(actor, units, { year: next.year });
  return { ...next, units };
};

// ---------------------------------------------------------------------------------------------
// Phase W3 (plans/independent-cities.md 5): majors and independents.

/** Tiles where an independent's raid party stands (raids.js `unit.raidOf`): Set of tiles. */
export const raidPartyTiles = (state) => {
  const out = new Set();
  Object.values(state.units).forEach((u) => { if (u.raidOf && u.strength > 0 && !u.embarkedOn) { const t = unitTile(state, u); if (t != null) out.add(t); } });
  return out;
};

/**
 * The hunt (independents 5, "AI majors garrison their borders against raiders"): a raid party on
 * this nation's land (not a city centre) is attacked by its stack on a tile next to it when the
 * estimate gives RELIEF_MIN_P. One battle per party a turn.
 */
export const aiHuntRaiders = (state, nationId, raidTiles, rng) => {
  const tiles = getTiles();
  const tileOwner = state.world?.tileOwner || {};
  const mine = [...raidTiles].filter((t) => { const c = state.regions[tileOwner[t]]; return c?.owner === nationId && c.tile !== t; }).sort((a, b) => a - b);
  if (!mine.length) return state;
  let next = state;
  for (const t of mine) {
    const byTile = landUnitsByTile(next);
    const party = (byTile.get(t) || []).filter((u) => u.raidOf);
    if (!party.length || !canAttack(next, nationId, party[0].ownerId)) continue;
    const bases = new Set();
    tiles.neighbors[t].forEach((n) => (byTile.get(n) || []).forEach((u) => { if (u.ownerId === nationId && (u.movesLeft ?? 1) > 0 && !isUnitInBattle(next, u.id)) bases.add(u.regionId); }));
    for (const from of [...bases].sort()) {
      if (next.regions[from]?.owner !== nationId) continue;
      const actor = { ...next, playerNationId: nationId, resources: getPool(next, nationId), techAgeId: getTechAgeId(next, nationId) };
      const v = validateFieldAttack(actor, from, t, { ignoreCost: true });
      if (!v.ok) continue;
      const ctx = getFieldBattleContext(actor, v);
      if (estimateBattle(getFieldResolveArgs(v, ctx)).pWin < RELIEF_MIN_P) continue;
      const battle = resolveAutoBattle(actor, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId: v.fromRegionId }, rng);
      const r = applyFieldResult({ ...actor, units: next.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId, viewerId: state.playerNationId });
      next = { ...next, units: r.units, regions: r.regions, nations: { ...r.nations, [nationId]: { ...r.nations[nationId], economy: next.nations[nationId]?.economy } }, hiredCommanders: r.hiredCommanders, appliedBattleIds: r.appliedBattleIds, world: r.world || next.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport };
      break;
    }
  }
  return next;
};

/**
 * A campaign against an independent (indepPolicy.js `nation.indepGoal`, kind 'conquer'): the tagged
 * siege force (`unit.indepOp`) marches on tiles to its city, halts beside it (the siege, sieges.js)
 * and assaults when the estimate gives ASSAULT_MIN_P (the floor once the walls are down to ASSAULT_HP);
 * an empty city is attacked through its defences (cityAssault.js). A siege never takes the city: only
 * an assault does. No war: the assault is an invasion with `war` null.
 */
export const processIndependentOps = (state, nationId, rng) => {
  const goal = state.nations[nationId]?.indepGoal;
  const city = goal ? state.regions[goal.cityId] : null;
  if (!goal || goal.kind !== 'conquer' || !city || city.owner !== goal.id || city.tile == null) return state;
  if (state.wars.some((w) => w.active && (w.aggressor === nationId || w.enemy === nationId))) return state;
  const tiles = getTiles();
  const groups = new Map();
  Object.values(state.units).forEach((u) => {
    if (u.ownerId !== nationId || u.indepOp !== goal.id || u.domain !== 'land' || u.embarkedOn || !(u.strength > 0) || isUnitInBattle(state, u.id)) return;
    const key = `${u.regionId}|${unitTile(state, u)}`;
    const l = groups.get(key); if (l) l.push(u); else groups.set(key, [u]);
  });
  if (!groups.size) return state; // no siege force: nothing to copy (most turns of a campaign's muster)
  let next = { ...state, units: { ...state.units } };
  let marching = false;
  const failKey = `indep:${goal.id}`;
  for (const [key, seen] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const stack = seen.map((u) => next.units[u.id]).filter(Boolean); // fresh: an assault above can kill some
    if (!stack.length) continue;
    const from = key.split('|')[0];
    if (next.regions[from]?.owner !== nationId) continue;
    const at = unitTile(next, stack[0]);
    const beside = at != null && touchesCity(next, tiles, at, city.id);
    if (!beside && stack.some((u) => u.route?.length)) { marching = true; continue; }
    if (!stack.every((u) => (u.movesLeft ?? 1) > 0)) continue;
    if (beside) {
      // An earlier stack's assault from the same region may have killed some of these: never revive them.
      stack.forEach((u) => { if (u.route && next.units[u.id]) next.units[u.id] = { ...next.units[u.id], route: null, routeHalt: null }; });
      const cur = next.regions[city.id];
      if (cur.owner !== goal.id) break;
      const pool = getPool(next, nationId);
      const actor = { ...next, playerNationId: nationId, resources: pool, techAgeId: getTechAgeId(next, nationId) };
      const v = validateInvasion(actor, from, city.id);
      if (!v.ok) continue;
      const wallsDown = !!cur.siege && cur.siege.hp < ASSAULT_HP * siegeMaxHp(cur, next.greatProjects);
      const ctx = getInvasionBattleContext(actor, v);
      // Not worth an assault yet: the force holds its tile, which keeps the siege on (the same bars
      // as a war's fronts above).
      const notYet = v.defenderUnits.length
        ? !atLeast(estimateBattle(getResolveBattleArgs(v, ctx)).pWin, wallsDown ? FIGHT_FLOOR_P : ASSAULT_MIN_P)
        : !cityAttackWorthIt(next, nationId, v.attackerUnits, cur);
      if (notYet) continue;
      const battle = resolveAutoBattle(actor, getResolveBattleArgs(v, ctx), { kind: 'invasion', cityId: city.id, fromRegionId: from }, rng);
      const result = applyInvasionResult(actor, { ...v, fromRegionId: from, targetRegionId: city.id, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed(), viewerId: state.playerNationId, militia: battle.inputs.militia });
      next = { ...next, regions: result.regions, units: { ...result.units }, wars: result.wars, hiredCommanders: result.hiredCommanders, appliedBattleIds: result.appliedBattleIds, world: result.world || next.world,
        nations: { ...result.nations, [nationId]: { ...result.nations[nationId], economy: applyCosts(pool, ACTION_COSTS.launchInvasion) } } };
      if (next.regions[city.id].owner === nationId) break;
      continue;
    }
    const failed = stack[0].routeFailed;
    if (failed && failed.goal === failKey && failed.until > state.turnNumber) continue;
    const path = findTilePath({ ...next, playerNationId: nationId }, at, city.tile, nationId, { maxSteps: AI_MARCH_STEPS });
    if (!path.path) { stack.forEach((u) => { if (next.units[u.id]) next.units[u.id] = { ...next.units[u.id], routeFailed: { goal: failKey, until: state.turnNumber + ROUTE_RETRY_TURNS } }; }); continue; }
    const pace = stackPace(stack, getResearched(state, nationId));
    // A battle earlier in this loop can have killed part of the stack: never write a dead unit back.
    stack.forEach((u) => { if (next.units[u.id]) next.units[u.id] = { ...next.units[u.id], route: path.path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, routeFailed: undefined }; });
    marching = true;
  }
  if (marching) next = marchAiArmies(next, nationId);
  return next;
};

// Island fronts need real paid transports and cargo. Shared actions retain interception,
// reach, transport capacity, supply costs and the same landing aftermath as player orders.
export const processAINavalOperations = state => {
  let next=state;
  for(const id of Object.keys(next.nations).sort()){
    if(id===state.playerNationId || next.nations[id].isEliminated)continue;
    const enemies=new Set(next.wars.filter(w=>w.active&&(w.aggressor===id||w.enemy===id)).map(w=>w.aggressor===id?w.enemy:w.aggressor));
    if(!enemies.size)continue;
    const actor=()=>({...next,playerNationId:id,resources:getPool(next,id),techAgeId:getTechAgeId(next,id)});
    const apply=action=>{
      const before=actor(),after=gameReducer(before,action);
      // A refused order (the reducer only logged why) is no order: its "That army has already moved" line
      // was written as if to the player, four a turn in the player's log (playtest 4 P4-M4).
      if(after===before||(after.units===before.units&&after.regions===before.regions&&after.wars===before.wars))return false;
      // The reducer ran as this nation: a battle report it wrote names the AI as "the player". Keep
      // only the battles the real player fought, seen from their side (battleReports.js).
      const me=state.playerNationId;
      const fresh=(after.battleReports||[]).slice(0,(after.battleReportSeq||0)-(before.battleReportSeq||0)).filter(b=>b.attackerNationId===me||b.defenderNationId===me).map(b=>({...b,playerSide:b.attackerNationId===me?'attacker':'defender'}));
      const reports=fresh.length?[...fresh,...(next.battleReports||[])].slice(0,(after.battleReports||[]).length||fresh.length):next.battleReports;
      next={...next,regions:after.regions,units:after.units,wars:after.wars,world:after.world,rngSeed:after.rngSeed,nextUnitSeq:after.nextUnitSeq,hiredCommanders:after.hiredCommanders,nations:{...after.nations,[id]:{...after.nations[id],economy:after.resources}},logs:after.logs,battleReports:reports,battleReportSeq:after.battleReportSeq,lastBattleReport:fresh.length?after.lastBattleReport:next.lastBattleReport};
      return true;
    };
    const aiFleetAttack=(fleet)=>{
      const tiles=getTiles();
      const from=unitTile(next,fleet);
      if(from==null)return false;
      const mine=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval'&&u.strength>0&&unitTile(next,u)===from);
      const power=mine.reduce((s,u)=>s+u.strength,0);
      for(const n of tiles.neighbors[from]){
        if(tiles.land[n]===1)continue;
        const foe=enemyFleetsAt({...next,playerNationId:id},n,id);
        if(!foe.length || foe.reduce((s,u)=>s+u.strength,0)*AI_FLEET_ATTACK_RATIO>power)continue;
        // Against the player's fleet: queued for the player's Command or Auto (battleQueue.js).
        if(foe[0].ownerId===state.playerNationId){
          const v=validateFleetAttack({...next,playerNationId:id,resources:getPool(next,id)},from,n,{ignoreCost:true});
          if(!v.ok)continue;
          const before=next;
          next=queueAgainstPlayer(next,v,id,{next:()=>(((next.rngSeed||0)+n*2654435761)>>>0)/4294967296},'naval');
          return next!==before;
        }
        return apply({type:ActionTypes.ATTACK_FLEET,payload:{fromTile:from,tile:n}});
      }
      return false;
    };
    const coast=Object.keys(next.regions).filter(r=>enemies.has(next.regions[r].owner)&&isCoastal(r)).sort();
    const ports=getOwnedRegionIds(next.regions,id).filter(isCoastal).sort();
    if(!coast.length || !ports.length)continue;
    let fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval'&&u.strength>0&&!isUnitInBattle(next,u.id));
    if(!fleets.length){
      const port=ports.find(p=>coast.some(t=>isReachableBySea(p,t,ageOf(next,id)))&&Object.values(next.units).some(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===p&&!u.embarkedOn));
      if(port && (getPool(next,id).gold || 0)>300)apply({type:ActionTypes.RECRUIT_UNIT,payload:{regionId:port,classId:'naval'}});
      fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval');
    }
    for(const fleet of fleets.sort((a,b)=>a.id.localeCompare(b.id))){
      if((fleet.movesLeft ?? 0)<=0 || isUnitInBattle(next,fleet.id))continue;
      // An enemy fleet on a sea tile beside this one, weaker by AI_FLEET_ATTACK_RATIO: a sea battle (navalBattle.js).
      if(aiFleetAttack(fleet))continue;
      const target=coast.find(t=>isReachableBySea(fleet.regionId,t,ageOf(next,id))||getNeighborIds(fleet.regionId).includes(t));
      if(!target)continue;
      const cargo=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===fleet.regionId&&!u.embarkedOn&&u.movesLeft>0&&!isUnitInBattle(next,u.id));
      for(const unit of cargo.slice(0,fleet.transportCapacity || 0))apply({type:ActionTypes.EMBARK_UNIT,payload:{landUnitId:unit.id,navalUnitId:fleet.id}});
      const embarked=Object.values(next.units).filter(u=>u.embarkedOn===fleet.id);
      const defenders=Object.values(next.units).filter(u=>u.regionId===target&&u.domain==='land');
      if(!embarked.length || (defenders.length && estimateBattle({attackerUnits:embarked,defenderUnits:defenders,battleType:'landing',attackerAgeId:getTechAgeId(next,id),defenderAgeId:getTechAgeId(next,next.regions[target]?.owner)}).pWin<LANDING_MIN_P))continue;
      // On the player's coast the landing (and the player's fleets' interception) waits in the
      // battle queue for their Command or Auto (aiLanding.js); elsewhere it is fought at once.
      if(next.regions[target]?.owner===state.playerNationId){
        const v=validateAmphibious(actor(),fleet.id,target);
        if(!v.ok)continue;
        const units={...next.units};
        [fleet,...v.embarkedLandUnits].forEach(u=>{units[u.id]={...units[u.id],movesLeft:0};});
        next={...next,units,nations:{...next.nations,[id]:{...next.nations[id],economy:applyCosts(getPool(next,id),ACTION_COSTS.amphibiousAssault)}},pendingDefenses:[...(next.pendingDefenses||[]),...landingRecords(next,v,id)]};
        continue;
      }
      apply({type:ActionTypes.AMPHIBIOUS_ASSAULT,payload:{navalUnitId:fleet.id,targetRegionId:target}});
    }
  }
  return next;
};
