import { gameReducer } from './gameReducer';
import { getResearched } from './nationState';
import { ActionTypes } from '../data/types';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { coloniesOf, colonySlots, foundColony, foundingCost, validateColony } from './colonies';
// Persistent front objectives and real, one-hop army orders. All combat uses invasion aftermath.
import { getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getPool, getTechAgeId } from './nationState';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, applyInvasionResult } from './invasion';
import { resolveBattle } from './battle';
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
import { enemyFleetsAt, AI_FLEET_ATTACK_RATIO } from './navalBattle';
import { estimateBattle } from './lanchester';
import { getTotalDev } from './development';
import { getDefenseLevelDamageReductionMultiplier } from './siege';
import { getCapital } from '../data/regions';
import { ringsForKm } from '../data/geo/gridScale';

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
export const SALLY_RATIO = 1.3;
export const SALLY_MIN_P = 0.6;
export const RELIEF_MIN_P = 0.6;
export const ASSAULT_MIN_P = 0.45;
export const LANDING_MIN_P = 0.5;
const PREFILTER = 0.5;
export const aiSally = (state, nationId, rng) => {
  let next = state;
  for (const city of Object.values(state.regions).filter((c) => c.owner === nationId && c.siege?.by).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const by = besiegersOf(next, city);
    const garrison = Object.values(next.units).filter((u) => u.ownerId === nationId && u.regionId === city.id && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && (u.movesLeft ?? 1) > 0 && unitTile(next, u) === city.tile);
    if (!garrison.length) continue;
    const mine = garrison.reduce((s, u) => s + u.strength, 0);
    const targets = new Map();
    by.forEach((list) => list.forEach((u) => { const t = unitTile(next, u); targets.set(t, (targets.get(t) || 0) + u.strength); }));
    const weakest = [...targets].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    if (!weakest || mine < weakest[1] * PREFILTER) continue;
    const actor = { ...next, playerNationId: nationId, resources: getPool(next, nationId), techAgeId: getTechAgeId(next, nationId) };
    const v = validateFieldAttack(actor, city.id, weakest[0], { ignoreCost: true });
    if (!v.ok) continue;
    const ctx = getFieldBattleContext(actor, v);
    if (estimateBattle(getFieldResolveArgs(v, ctx)).pWin < SALLY_MIN_P) continue;
    const battle = resolveBattle({ ...getFieldResolveArgs(v, ctx), rng });
    const r = applyFieldResult({ ...actor, units: next.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId });
    next = { ...next, units: r.units, world: r.world || next.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport,
      logs: [...next.logs, ...r.logs.slice(next.logs.length).filter(() => by.has(state.playerNationId))] };
  }
  return next;
};

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

export const processAIOperations = (state, rng) => {
  let next = { ...state, units: { ...state.units }, aiOperations: {}, pendingDefenses: [...(state.pendingDefenses || [])] };
  const committed = new Set();
  let unitsByRegion = null; let unitsByRegionFor = null;
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
    const wars = next.wars.filter(w => w.active && (w.aggressor === nationId || w.enemy === nationId));
    if (!wars.length) continue;
    next = aiSally(next, nationId, rng);
    const enemies = new Set(wars.map(w => w.aggressor === nationId ? w.enemy : w.aggressor));
    const land = getOwnedRegionIds(next.regions, nationId);
    const fronts = new Set(land.filter(id => getNeighborIds(id).some(n => enemies.has(next.regions[n]?.owner))));
    // Threatened cities (threat.js): besieged, under invasion, or enemy strength within 4 tiles
    // over the garrison; the AI defends them before it advances.
    const byTile = landUnitsByTile(next);
    const threatened = new Set(threatenedCities(next, nationId, enemies, byTile));
    const goals = threatened.size ? threatened : fronts;
    next.aiOperations[nationId] = { turn: state.turnNumber, objective: threatened.size ? 'defend' : 'advance', startedTurn:state.aiOperations?.[nationId]?.objective === (threatened.size ? 'defend' : 'advance') ? state.aiOperations[nationId].startedTurn : state.turnNumber, fronts: [...fronts].sort(), targets: [...goals].sort() };
    const tiles = getTiles();
    const stacks = new Map();
    for (const u of Object.values(next.units)) {
      if (u.ownerId !== nationId || u.domain !== 'land' || u.classId === 'settler' || u.embarkedOn || u.strength <= 0 || isUnitInBattle(next, u.id)) continue;
      // Stacks by tile: an army on the road stands apart from the garrison of its base.
      const key = `${u.regionId}|${unitTile(next, u)}`;
      const stack = stacks.get(key) || []; stack.push(u); stacks.set(key, stack);
    }
    let marching = false;
    for (const [key, stack] of [...stacks].sort(([a], [b]) => a.localeCompare(b))) {
      const from = key.split('|')[0];
      if (!stack.every(u => u.movesLeft > 0 && !committed.has(u.id)) || next.regions[from]?.owner !== nationId) continue;
      if (stack.some(u => u.route?.length)) { marching = true; continue; } // already on the road: the march phase below walks it
      const pool = getPool(next, nationId);
      const at = unitTile(next, stack[0]);
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
        const battle = resolveBattle({ ...getFieldResolveArgs(v, ctx), rng });
        const r = applyFieldResult({ ...actor, units: next.units }, v, battle, { rngSeed: rng.getSeed(), attackerNationId: nationId });
        stack.forEach(u => committed.add(u.id));
        next = { ...next, units: r.units, world: r.world || next.world, wars: r.wars, rngSeed: r.rngSeed, battleReports: r.battleReports, battleReportSeq: r.battleReportSeq, lastBattleReport: r.lastBattleReport,
          logs: [...next.logs, ...r.logs.slice(next.logs.length).filter(() => v.defenderNationId === state.playerNationId)] };
        relieved = true;
        break;
      }
      if (relieved) continue;
      // Units by region, rebuilt only when a battle replaced the units map (the scan per enemy
      // neighbour per stack was most of the phase at a thousand units).
      if (unitsByRegionFor !== next.units) { unitsByRegion = new Map(); Object.values(next.units).forEach(u => { const l = unitsByRegion.get(u.regionId); if (l) l.push(u); else unitsByRegion.set(u.regionId, [u]); }); unitsByRegionFor = next.units; }
      const unitsIn = (id) => unitsByRegion.get(id) || [];
      const ranked = rankTargets(next, nationId, wars, stack, getNeighborIds(from).filter(id => enemies.has(next.regions[id]?.owner) && !next.pendingDefenses.some(d=>d.regionId===id) && !unitsIn(id).some(u=>isUnitInBattle(next,u.id))), unitsIn);
      // Attacks come from tiles that touch the city's land; a city farther off is marched on.
      const candidates = ranked.filter(id => touchesCity(next, tiles, at, id));
      const target = threatened.size && !threatened.has(from) ? null : candidates[0];
      if (target) {
        const actor = { ...next, playerNationId: nationId, resources: pool, techAgeId: getTechAgeId(next, nationId) };
        const v = validateInvasion(actor, from, target);
        if (!v.ok) continue;
        const city = next.regions[target];
        const wallsDown = !!city.siege && city.siege.hp < ASSAULT_HP * siegeMaxHp(city);
        const ctx = getInvasionBattleContext(actor, v);
        // Not worth an assault yet: the stack holds its tile, which keeps the siege on (sieges.js).
        if (!wallsDown && v.defenderUnits.length && estimateBattle(getResolveBattleArgs(v, ctx)).pWin < ASSAULT_MIN_P) continue;
        // Keep a defensive reserve when the capital is under siege elsewhere.
        stack.forEach(u => committed.add(u.id));
        const chargedPool = applyCosts(pool, ACTION_COSTS.launchInvasion);
        if (next.regions[target].owner === state.playerNationId) {
          next.nations = { ...next.nations, [nationId]: { ...next.nations[nationId], economy: chargedPool } };
          stack.forEach(u => { next.units[u.id] = { ...u, movesLeft: 0 }; });
          next.pendingDefenses.push({ id: `op_${state.turnNumber}_${nationId}_${from}`, warId: v.war.id, aggressorId: nationId, fromRegionId: from, regionId: target, attackerUnitIds: stack.map(u => u.id), defenderUnitIds: v.defenderUnits.map(u=>u.id), synthetic: [], seed: Math.floor(rng.next()*0xffffffff)>>>0, turn: state.turnNumber });
        } else {
          const battle = resolveBattle({ ...getResolveBattleArgs(v, ctx), rng });
          const result = applyInvasionResult(actor, { ...v, fromRegionId: from, targetRegionId: target, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed() });
          next = { ...next, regions: result.regions, units: result.units, wars: result.wars, hiredCommanders: result.hiredCommanders,
            nations: { ...result.nations, [nationId]: { ...result.nations[nationId], economy: chargedPool } },
            logs: [...next.logs, { year: next.year, type: 'combat', message: `${next.nations[nationId].name} attacks from ${from} toward ${target}.` }] };
        }
      } else {
        const to = routeStep(next.regions, nationId, from, goals);
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
            logs: next.regions[raid.cityId]?.owner === state.playerNationId ? [...next.logs, { year: next.year, type: 'combat', message: `${next.nations[nationId].name} pillages the land of ${next.regions[raid.cityId].name} (${tiles.names[at] || 'a tile'}).` }] : next.logs };
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
        const path = findTilePath(actor, at, target, nationId, { maxSteps: AI_MARCH_STEPS });
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
      if(after===before)return false;
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
        return apply({type:ActionTypes.ATTACK_FLEET,payload:{fromTile:from,tile:n}});
      }
      return false;
    };
    const coast=Object.keys(next.regions).filter(r=>enemies.has(next.regions[r].owner)&&isCoastal(r)).sort();
    const ports=getOwnedRegionIds(next.regions,id).filter(isCoastal).sort();
    if(!coast.length || !ports.length)continue;
    let fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval'&&u.strength>0&&!isUnitInBattle(next,u.id));
    if(!fleets.length){
      const port=ports.find(p=>coast.some(t=>isReachableBySea(p,t,next.age))&&Object.values(next.units).some(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===p&&!u.embarkedOn));
      if(port && (getPool(next,id).gold || 0)>300)apply({type:ActionTypes.RECRUIT_UNIT,payload:{regionId:port,classId:'naval'}});
      fleets=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='naval');
    }
    for(const fleet of fleets.sort((a,b)=>a.id.localeCompare(b.id))){
      if((fleet.movesLeft ?? 0)<=0 || isUnitInBattle(next,fleet.id))continue;
      // An enemy fleet on a sea tile beside this one, weaker by AI_FLEET_ATTACK_RATIO: a sea battle (navalBattle.js).
      if(aiFleetAttack(fleet))continue;
      const target=coast.find(t=>isReachableBySea(fleet.regionId,t,next.age)||getNeighborIds(fleet.regionId).includes(t));
      if(!target)continue;
      const cargo=Object.values(next.units).filter(u=>u.ownerId===id&&u.domain==='land'&&u.regionId===fleet.regionId&&!u.embarkedOn&&u.movesLeft>0&&!isUnitInBattle(next,u.id));
      for(const unit of cargo.slice(0,fleet.transportCapacity || 0))apply({type:ActionTypes.EMBARK_UNIT,payload:{landUnitId:unit.id,navalUnitId:fleet.id}});
      const embarked=Object.values(next.units).filter(u=>u.embarkedOn===fleet.id);
      const defenders=Object.values(next.units).filter(u=>u.regionId===target&&u.domain==='land');
      if(!embarked.length || (defenders.length && estimateBattle({attackerUnits:embarked,defenderUnits:defenders,battleType:'landing',attackerAgeId:getTechAgeId(next,id),defenderAgeId:getTechAgeId(next,next.regions[target]?.owner)}).pWin<LANDING_MIN_P))continue;
      apply({type:ActionTypes.AMPHIBIOUS_ASSAULT,payload:{navalUnitId:fleet.id,targetRegionId:target}});
    }
  }
  return next;
};
