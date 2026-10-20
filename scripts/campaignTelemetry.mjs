// scripts/campaignTelemetry.mjs
// Campaign telemetry for the balance harness (plans/playtest-audits-implementation-plan.md W00,
// section 8; addendum X15, X22, X24). Tooling only: it reads game states, it never changes a rule.
// It has no engine imports (createActionCounter below counts actions by type), so the vitest sim (.claude/skills/balance-sim/worldStats.sim.js) and
// scripts/simulate.mjs share it; engine helpers it needs are passed in.
//
//   const policy = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, ... }, ... });
//   const tel = createTelemetry({ playerId, isIndependent, authorityOf, getOverextension, metNations, getTiles });
//   per turn:  ({ state } = policy.answer(state));  const next = resolveTurn(state);  tel.observe(state, next);
//   snapshot:  tel.snapshot(next)  (flat numbers, additive to worldStats)   tel.report(next)  (nested, for the baseline file)
//
// Policies (POLICY env in worldStats): 'passive' is the old harness (accepts free white peace,
// refuses costly ones, auto-defends) and is the default so existing runs hash as before. 'scripted'
// answers every blocker in src/engine/turnBlockers.js (events, peace, defenses, demands, tribute,
// join offers), queues what an AI would build in every idle city of the player and sends its
// settlers to the best site in reach, so first-build ETAs and city counts mean something. It never
// declares war and never moves an army.

// Per-action use counts (differentiation plan U1, read by U33's economy measurement). Dev tooling
// only, outside game logic: it counts the actions handed to the reducer and never changes one.
//   const counter = createActionCounter(ActionTypes);
//   const reducer = counter.wrap(gameReducer);       // every call through it is counted
//   counter.get('QUEUE_PRODUCTION')                   // 0 for a type never dispatched, never undefined
//   counter.table()                                   // { [type]: n } with every known type, zeros kept
//   counter.rows()                                    // [{ type, count }] most used first, then by name
// In a dev browser the same counts come from installBrowserActionCounter (run in the page).
export const createActionCounter = (ActionTypes = {}) => {
  const known = [...new Set(Object.values(ActionTypes).filter((t) => typeof t === 'string'))];
  const counts = new Map();
  const count = (action) => {
    const type = action?.type;
    if (typeof type !== 'string' || !type) return;
    counts.set(type, (counts.get(type) || 0) + 1);
  };
  const add = (type, n) => { if (typeof type === 'string' && Number.isFinite(n) && n > 0) counts.set(type, (counts.get(type) || 0) + n); };
  const wrap = (reducer) => (state, action) => { count(action); return reducer(state, action); };
  const get = (type) => counts.get(type) || 0;
  const table = () => {
    const out = {};
    for (const t of [...known, ...counts.keys()].sort()) out[t] = get(t);
    return out;
  };
  const rows = () => Object.entries(table()).map(([type, n]) => ({ type, count: n })).sort((a, b) => (b.count - a.count) || (a.type < b.type ? -1 : 1));
  const merge = (obj) => { for (const [t, n] of Object.entries(obj || {})) add(t, n); };
  const total = () => [...counts.values()].reduce((a, n) => a + n, 0);
  return { count, wrap, get, table, rows, merge, total };
};

// Run in a dev page (Playwright page.evaluate, or the console): counts every action the UI hands
// to GameProvider's dispatch into window.__actionCounts, without touching the game's code. It finds
// GameProvider through React's fiber (the hook whose callback is window.__game.dispatch) and watches
// the ref that dispatch writes each action into (src/context/GameContext.jsx lastActionRef). Returns
// true once installed (again on a later call: no double count).
export function installBrowserActionCounter() {
  if (window.__actionCounterInstalled) return true;
  const target = window.__game?.dispatch;
  if (!target) return false;
  const rootEl = document.getElementById('root') || document.body;
  const key = Object.keys(rootEl).find((k) => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$'));
  if (!key) return false;
  const stack = [rootEl[key]?.stateNode?.current || rootEl[key]];
  const seen = new Set();
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    const hooks = [];
    for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next) hooks.push(h);
    const cb = hooks.findIndex((h) => Array.isArray(h.memoizedState) && h.memoizedState[0] === target);
    if (cb >= 1) {
      // the ref written by dispatch is the useRef just before the useCallback that holds no state
      for (let i = cb - 1; i >= 0; i--) {
        const ref = hooks[i].memoizedState;
        if (!ref || typeof ref !== 'object' || !('current' in ref) || Object.keys(ref).length !== 1) continue;
        if (ref.current && typeof ref.current === 'object' && ref.current.regions) continue; // a state ref
        let value = ref.current;
        window.__actionCounts = window.__actionCounts || {};
        Object.defineProperty(ref, 'current', {
          configurable: true,
          get: () => value,
          set: (v) => { if (v && typeof v.type === 'string') window.__actionCounts[v.type] = (window.__actionCounts[v.type] || 0) + 1; value = v; }
        });
        window.__actionCounterInstalled = true;
        return true;
      }
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  return false;
}

const median = (xs) => { if (!xs.length) return 0; const a = [...xs].sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);

const buildingCount = (city) => Object.values(city.buildings?.categories || {}).reduce((a, t) => a + (Number.isFinite(t) ? t + 1 : 0), 0);

/**
 * The scripted player: answers what blocks the turn. DEMANDS ('pay' | 'refuse') is the policy for a
 * major's demand and an independent's tribute demand; default 'refuse' (the passive baseline).
 * Everything it answers is recorded in `log` for the tribute metrics.
 */
export const createScriptedPlayer = ({ engine, demands = 'refuse', production = true, settle = true, rush = false, opinionOf = null, counter = null }) => {
  const { ActionTypes } = engine;
  // counter (createActionCounter): every action this player hands the reducer is counted by type
  const gameReducer = counter ? counter.wrap(engine.gameReducer) : engine.gameReducer;
  const log = { demands: [], tribute: [], peace: 0, defenses: 0, events: 0, joins: 0, queued: 0, settled: 0 };
  const answer = (state) => {
    let s = state;
    const me = s.playerNationId;
    if (s.pendingPeaceOffer) { s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE }); log.peace += 1; }
    if (s.pendingDefenses?.length) { log.defenses += s.pendingDefenses.length; s = gameReducer(s, { type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO }); }
    for (const d of [...(s.tributeDemands || [])]) {
      const pay = demands === 'pay';
      const g0 = s.resources.gold;
      s = gameReducer(s, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay } });
      log.tribute.push({ turn: s.turnNumber, from: d.indepId, quoted: d.gold, paid: Math.round(g0 - s.resources.gold), gold: Math.round(g0), outcome: pay ? 'paid' : 'refused' });
    }
    if (s.pendingDemand) {
      const d = s.pendingDemand; const g0 = s.resources.gold; const op0 = opinionOf ? opinionOf(s, d.from) : null;
      s = gameReducer(s, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: demands === 'pay' } });
      log.demands.push({ turn: s.turnNumber, from: d.from, kind: d.kind, quoted: d.amount ?? null, paid: Math.round(g0 - s.resources.gold), gold: Math.round(g0), outcome: demands === 'pay' ? 'paid' : 'refused', opinionBefore: op0 == null ? null : Math.round(op0), opinionAfter: opinionOf ? Math.round(opinionOf(s, d.from)) : null });
    }
    if (s.joinOffers?.length) { log.joins += s.joinOffers.length; s = { ...s, joinOffers: [] }; }
    if (s.activeEventId || s.activeEvent) { log.events += 1; s = { ...s, activeEvent: null, activeEventId: null }; }
    if (production && engine.chooseProduction) {
      const counts = engine.nationCounts(s)[me] || { settlers: 0, outposts: 0, landUnits: 0 };
      const owned = Object.values(s.regions).filter((c) => c.owner === me).length;
      const ageId = engine.getEffectiveAgeId ? engine.getEffectiveAgeId(s.age, engine.getTechAgeId(s, me)) : engine.getTechAgeId(s, me); // the old engine (a base commit) still had the calendar floor
      const ctx = { researched: engine.getResearched(s, me), ageId, turnNumber: s.turnNumber, citiesOwned: owned || 1, speedMult: engine.speedCostMult(s.gameSpeed, ageId), trainMult: engine.speedTrainMult ? engine.speedTrainMult(s.gameSpeed, ageId) : undefined, greatProjects: s.greatProjects || {}, units: s.units, counts: { ...counts } };
      for (const city of Object.values(s.regions)) {
        if (city.owner !== me || city.outpost || city.razing || city.tile == null || city.production?.current) continue;
        const item = engine.chooseProduction(s, city, ctx);
        if (!item) continue;
        const before = s;
        s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: city.id, item } });
        if (s !== before && s.regions[city.id]?.production?.current) { log.queued += 1; if (item.kind === 'unit') ctx.counts.landUnits += 1; }
      }
    }
    // RUSH=1 (CB04): the player also buys what its cities lack, like the AI (aiEconomy.js
    // tryRushProduction): the front order of each city, biggest first, when it would take more than
    // 3 turns and the price leaves a reserve of 200 gold. Gold spent this way is in log.rushGold.
    if (rush && engine.rushQuote) {
      const mine = Object.values(s.regions).filter((c) => c.owner === me && c.production?.current).sort((a, b) => (b.size - a.size) || (a.id < b.id ? -1 : 1));
      for (const city of mine) {
        const q = engine.rushQuote(s, city.id, 0);
        if (!q.ok || !(q.turns > 3) || s.resources.gold - q.gold < 200) continue;
        s = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: city.id, index: 0 } });
        log.rushes = (log.rushes || 0) + 1; log.rushGold = (log.rushGold || 0) + q.gold;
      }
    }
    // Settlers without a destination walk to the best site in reach (the AI's own site search), so the
    // player's city count and the second-city ETA mean something. Founding is the engine's (processSettlers).
    if (settle && engine.bestSites) {
      const ageId = engine.getEffectiveAgeId ? engine.getEffectiveAgeId(s.age, engine.getTechAgeId(s, me)) : engine.getTechAgeId(s, me); // the old engine (a base commit) still had the calendar floor
      for (const u of Object.values(s.units)) {
        if (u.ownerId !== me || u.classId !== 'settler' || u.target != null || u.tile == null) continue;
        const site = engine.bestSites(s, me, u.tile, ageId, { rings: engine.MAX_SETTLE_RINGS, limit: 1 })[0];
        if (!site) continue;
        const before = s;
        s = gameReducer(s, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile: site.tile } });
        if (s !== before) log.settled += 1;
      }
    }
    return { state: s };
  };
  return { answer, log };
};

const STACK_KINDS = ['moved', 'shuttle', 'besieging', 'waitRoute', 'idleHome', 'idleField'];

export const createTelemetry = ({ playerId, isIndependent = () => false, authorityOf = null, getOverextension = null, metNations = null, getTiles = null, traceFile = null, writeLine = null }) => {
  const wars = new Map(); // id -> { id, a, e, start, end, withPlayer, indep }
  const demandsSeen = new Set();
  const conquests = new Map(); // cityId -> { turn, owner } (a conquest not yet judged)
  const tallies = { sieges: 0, captures: 0, capturesFromMajors: 0, capturesFromIndep: 0, conquestsKept20: 0, conquestsLost20: 0, rebellionsStarted: 0, rebellionsOnPlayer: 0, rebellionsConqueredLand: 0, rebellionsSucceeded: 0, rebelCitiesPlayer: 0, playerCitiesLost: 0, bankruptcies: 0 };
  const stackSizes = []; const fieldStackSizes = []; const wallStackSizes = []; // AI majors at war: units per stack, one entry per stack per turn
  const move = { aiUnitTurns: 0, aiMoved: 0, warUnitTurns: 0, warMoved: 0, peaceUnitTurns: 0, peaceMoved: 0 };
  const stackStats = {}; // per war: { stackTurns, moved, shuttle, ... }
  const history = new Map(); // lead unit id -> last tiles
  const sieging = new Set();
  const first = { unit: null, settler: null, building: null, city2: null, wonder: null };
  let startUnits = null; let startBuildings = null; let startCities = null;
  const series = []; // { turn, gold, adm, dip, mil, majorsMet, ... } one row per observed turn
  const goldRange = { min: Infinity, max: -Infinity };
  const demandOutcome = [];

  const tilesOf = () => (getTiles ? getTiles() : null);

  const observeWars = (after) => {
    const t = after.turnNumber;
    for (const w of after.wars || []) {
      let rec = wars.get(w.id);
      if (!rec) {
        rec = { id: w.id, a: w.aggressor, e: w.enemy, start: w.startTurn ?? w.turn ?? t, end: null, withPlayer: w.aggressor === playerId || w.enemy === playerId, indep: isIndependent(after.nations[w.aggressor]) || isIndependent(after.nations[w.enemy]), cb: w.cb || null };
        wars.set(w.id, rec);
      }
      rec.battles = w.battles || 0;
      if (!w.active && rec.end == null) rec.end = t;
    }
  };

  const observeStacks = (before, after) => {
    const t = after.turnNumber; const tiles = tilesOf();
    const activeWars = (after.wars || []).filter((w) => w.active && w.aggressor !== playerId && w.enemy !== playerId);
    const warOf = {}; // nation -> war ids
    activeWars.forEach((w) => { (warOf[w.aggressor] ||= []).push(w.id); (warOf[w.enemy] ||= []).push(w.id); });
    // Unit movement rate of AI land units (settlers excluded): all, in a war, at peace.
    for (const u of Object.values(before.units || {})) {
      if (u.ownerId === playerId || !u.ownerId || u.ownerId === 'rebels' || u.domain !== 'land' || u.classId === 'settler') continue;
      const n = after.nations[u.ownerId]; if (!n || isIndependent(n)) continue;
      const a = after.units[u.id]; if (!a) continue;
      const moved = a.tile !== u.tile || a.regionId !== u.regionId;
      move.aiUnitTurns += 1; if (moved) move.aiMoved += 1;
      if (warOf[u.ownerId]) { move.warUnitTurns += 1; if (moved) move.warMoved += 1; } else { move.peaceUnitTurns += 1; if (moved) move.peaceMoved += 1; }
    }
    if (!activeWars.length) return;
    const enemiesOf = {}; activeWars.forEach((w) => { (enemiesOf[w.aggressor] ||= new Set()).add(w.enemy); (enemiesOf[w.enemy] ||= new Set()).add(w.aggressor); });
    const cityOwnerAt = new Map(); Object.values(after.regions).forEach((c) => { if (c.tile != null && c.owner) cityOwnerAt.set(c.tile, c.owner); });
    // One row per stack per war per turn (X22): why does a stack wait or shuttle?
    const stacks = {}; // `${owner}|${tile}` of the AFTER state
    for (const u of Object.values(after.units || {})) {
      if (u.domain !== 'land' || u.classId === 'settler' || !warOf[u.ownerId]) continue;
      const key = `${u.ownerId}|${u.tile ?? u.regionId}`;
      (stacks[key] ||= []).push(u);
    }
    const beforeTile = {}; for (const u of Object.values(before.units || {})) beforeTile[u.id] = u.tile ?? u.regionId;
    for (const list of Object.values(stacks)) {
      list.sort((p, q) => (p.id < q.id ? -1 : 1));
      const lead = list[0]; const owner = lead.ownerId; const tile = lead.tile ?? lead.regionId;
      const prevTile = beforeTile[lead.id];
      const hist = history.get(lead.id) || [];
      const movedNow = prevTile !== undefined && prevTile !== tile;
      const shuttle = movedNow && hist.length >= 2 && hist[hist.length - 2] === tile;
      history.set(lead.id, [...hist.slice(-3), tile]);
      const besieging = Object.values(after.regions).some((c) => c.siege?.by === owner && c.tile != null && (c.tile === tile || (tiles?.neighbors?.[tile] || []).includes(c.tile)));
      const home = Object.values(after.regions).some((c) => c.owner === owner && c.tile === tile);
      const hasRoute = !!lead.route?.length;
      if (!isIndependent(after.nations[owner])) {
        stackSizes.push(list.length);
        if (!home) fieldStackSizes.push(list.length);
        // At the walls: beside a city of a nation it is at war with (the stacks that assault).
        if (tiles && (tiles.neighbors?.[tile] || []).some((n) => { const o = cityOwnerAt.get(n); return o && enemiesOf[owner]?.has(o); })) wallStackSizes.push(list.length);
      }
      let verdict;
      if (shuttle) verdict = 'shuttle'; else if (movedNow) verdict = 'moved'; else if (besieging) verdict = 'besieging'; else if (hasRoute) verdict = 'waitRoute'; else if (home) verdict = 'idleHome'; else verdict = 'idleField';
      for (const wid of warOf[owner]) {
        const st = (stackStats[wid] ||= { stackTurns: 0, moved: 0, shuttle: 0, besieging: 0, waitRoute: 0, idleHome: 0, idleField: 0 });
        st.stackTurns += 1; st[verdict] += 1;
        if (traceFile && writeLine) writeLine(JSON.stringify({ turn: t, war: wid, nation: owner, lead: lead.id, units: list.length, strength: list.reduce((a, u) => a + (u.strength || 0), 0), tile, from: prevTile ?? null, verdict, routeLen: lead.route?.length || 0, routeTo: hasRoute ? lead.route[lead.route.length - 1] : null, halt: lead.routeHalt || null, attack: lead.routeAttack || null, indepOp: lead.indepOp || null }));
      }
    }
  };

  const observe = (before, after) => {
    const t = after.turnNumber; const me = playerId;
    if (startUnits == null) {
      startUnits = new Set(Object.values(before.units).filter((u) => u.ownerId === me).map((u) => u.id));
      startBuildings = Object.values(before.regions).filter((c) => c.owner === me).reduce((a, c) => a + buildingCount(c), 0);
      startCities = Object.values(before.regions).filter((c) => c.owner === me && !c.outpost).length;
    }
    observeWars(after);
    // First completions (ETAs) for the player.
    const mine = Object.values(after.units).filter((u) => u.ownerId === me);
    if (first.unit == null && mine.some((u) => !startUnits.has(u.id) && u.classId !== 'settler')) first.unit = t;
    if (first.settler == null && mine.some((u) => !startUnits.has(u.id) && u.classId === 'settler')) first.settler = t;
    const myCities = Object.values(after.regions).filter((c) => c.owner === me && !c.outpost);
    if (first.building == null && myCities.reduce((a, c) => a + buildingCount(c), 0) > startBuildings) first.building = t;
    if (first.city2 == null && myCities.length > startCities) first.city2 = t;
    // Treasury range and the per-turn series.
    const g = after.resources.gold || 0; goldRange.min = Math.min(goldRange.min, g); goldRange.max = Math.max(goldRange.max, g);
    series.push({ turn: t, gold: Math.round(g), adm: Math.round(after.resources.adm || 0), dip: Math.round(after.resources.dip || 0), mil: Math.round(after.resources.mil || 0), cities: myCities.length });
    // Sieges begun and captures (a conquest stamped this turn), conquests kept 20 turns.
    for (const c of Object.values(after.regions)) {
      const b = before.regions[c.id];
      if (c.siege?.by && !sieging.has(c.id)) { sieging.add(c.id); tallies.sieges += 1; } else if (!c.siege?.by) sieging.delete(c.id);
      if (b && b.owner !== c.owner && c.owner && c.conquest?.turn === t) {
        tallies.captures += 1; conquests.set(c.id, { turn: t, owner: c.owner });
        // Who lost it: a major (a war between majors) or an independent (a campaign on it).
        if (isIndependent(after.nations[b.owner]) || isIndependent(before.nations[b.owner])) tallies.capturesFromIndep += 1; else tallies.capturesFromMajors += 1;
        if (b.owner === me) tallies.playerCitiesLost += 1;
      }
      else if (b && b.owner !== c.owner && conquests.has(c.id) && conquests.get(c.id).owner === b.owner) { if (t - conquests.get(c.id).turn <= 20) tallies.conquestsLost20 += 1; conquests.delete(c.id); }
    }
    for (const [id, cq] of conquests) if (t - cq.turn >= 20) { if (after.regions[id]?.owner === cq.owner) tallies.conquestsKept20 += 1; conquests.delete(id); }
    // Bankruptcies of AI majors this turn (economy.js applyBankruptcy stamps lastBankruptcyTurn).
    for (const n of Object.values(after.nations)) {
      if (n.id === me || isIndependent(n) || n.lastBankruptcyTurn !== t) continue;
      if (before.nations[n.id]?.lastBankruptcyTurn !== t) tallies.bankruptcies += 1;
    }
    // Rebellions: a new rebel stack (rebellion breaks out) and a success (uprising reclaims the city).
    for (const u of Object.values(after.units)) {
      if (u.ownerId !== 'rebels' || u.isInsurgent || before.units[u.id] || u.spawnedTurn !== t) continue;
      tallies.rebellionsStarted += 1;
      const city = after.regions[u.regionId];
      if (city?.owner === me) tallies.rebellionsOnPlayer += 1;
      if (city?.formerOwner) tallies.rebellionsConqueredLand += 1;
    }
    for (const l of after.logs.slice(before.logs.length)) if (/^The uprising in .* succeeds/.test(l.message || '')) tallies.rebellionsSucceeded += 1;
    // Demands that arrived this turn: did a war on the player follow?
    for (const d of [after.pendingDemand, ...(after.tributeDemands || [])]) {
      if (!d) continue; const id = d.id || `demand:${d.from}:${t}`; if (demandsSeen.has(id)) continue; demandsSeen.add(id);
      demandOutcome.push({ id, turn: t, from: d.from || d.indepId, kind: d.kind || 'tribute', amount: d.amount ?? d.gold ?? null });
    }
    observeStacks(before, after);
  };

  const aiMajors = (s) => Object.values(s.nations).filter((n) => n.id !== playerId && !n.isEliminated && !isIndependent(n) && !String(n.id).startsWith('free_') && n.id !== 'rebels');
  let unitCountCache = null;
  const landUnitsOf = (s, id) => {
    if (!unitCountCache || unitCountCache.s !== s) {
      const c = {}; for (const u of Object.values(s.units || {})) if (u.domain === 'land' && u.classId !== 'settler') c[u.ownerId] = (c[u.ownerId] || 0) + 1;
      unitCountCache = { s, c };
    }
    return unitCountCache.c[id] || 0;
  };
  const aiCities = (s) => Object.values(s.regions).filter((c) => c.owner && c.owner !== playerId && !c.outpost && c.lastYields && !isIndependent(s.nations[c.owner]));

  const snapshot = (s) => {
    const me = playerId; const t = s.turnNumber;
    const mine = Object.values(s.regions).filter((c) => c.owner === me && !c.outpost);
    const prodMine = mine.map((c) => c.lastYields?.production ?? 0);
    const ai = aiCities(s); const prod = ai.map((c) => c.lastYields.production).sort((a, b) => a - b);
    const byOwner = {}; ai.forEach((c) => { (byOwner[c.owner] ||= []).push(c.lastYields.production); });
    const ranked = Object.entries(byOwner).sort((a, b) => b[1].length - a[1].length);
    const top = ranked[0]; const top5 = ranked.slice(0, 5);
    const majorsMet = metNations ? metNations(s, me).filter((id) => s.nations[id] && !isIndependent(s.nations[id]) && !s.nations[id].isEliminated).length : 0;
    const endedWars = [...wars.values()].filter((w) => w.end != null && !w.indep).map((w) => w.end - w.start);
    const allWars = [...wars.values()];
    const ownStacks = Object.values(stackStats);
    const sum = (k) => ownStacks.reduce((a, x) => a + x[k], 0);
    const st = sum('stackTurns');
    const out = {
      playerAdm: Math.round(s.resources.adm || 0), playerDip: Math.round(s.resources.dip || 0), playerMil: Math.round(s.resources.mil || 0),
      playerGoldMin: Math.round(goldRange.min === Infinity ? 0 : goldRange.min), playerGoldMax: Math.round(goldRange.max === -Infinity ? 0 : goldRange.max),
      playerCities: mine.length, playerProdMean: r1(mean(prodMine)), playerProdMin: Math.min(...(prodMine.length ? prodMine : [0])),
      aiCityProdP10: prod.length ? prod[Math.floor(0.1 * (prod.length - 1))] : 0, aiCityProdMedian: median(prod), aiCityProdP90: prod.length ? prod[Math.floor(0.9 * (prod.length - 1))] : 0,
      aiTopCities: top ? top[1].length : 0, aiTopProdMean: top ? r1(mean(top[1])) : 0, aiTop5ProdMean: r1(mean(top5.flatMap((e) => e[1]))),
      firstUnitTurn: first.unit ?? -1, firstSettlerTurn: first.settler ?? -1, firstBuildingTurn: first.building ?? -1, secondCityTurn: first.city2 ?? -1,
      demandsMajor: demandOutcome.filter((d) => d.kind !== 'tribute').length, demandsTribute: demandOutcome.filter((d) => d.kind === 'tribute').length,
      warsDeclaredMajors: allWars.filter((w) => !w.indep).length, warsDeclaredAll: allWars.length, warsOnPlayer: allWars.filter((w) => w.withPlayer && w.e === me).length,
      // Battles per war between majors (war.battles, battleOutcome.js), and wars that never saw one.
      battlesMajors: allWars.filter((w) => !w.indep).reduce((a, w) => a + (w.battles || 0), 0),
      battlesPerWar: r1(mean(allWars.filter((w) => !w.indep).map((w) => w.battles || 0))),
      warsZeroBattles: allWars.filter((w) => !w.indep && !(w.battles > 0)).length,
      warLenMedian: median(endedWars), warLenMean: r1(mean(endedWars)), warLenMax: endedWars.length ? Math.max(...endedWars) : 0, warsEnded: endedWars.length,
      sieges: undefined, siegesBegun: tallies.sieges, capturesTotal: tallies.captures, capturesFromMajors: tallies.capturesFromMajors, capturesFromIndep: tallies.capturesFromIndep, conquestsKept20: tallies.conquestsKept20, conquestsLost20: tallies.conquestsLost20,
      rebellionsStarted: tallies.rebellionsStarted, rebellionsOnPlayer: tallies.rebellionsOnPlayer, rebellionsConqueredLand: tallies.rebellionsConqueredLand, rebellionsSucceeded: tallies.rebellionsSucceeded,
      aiMoveRate: r3(move.aiMoved / Math.max(1, move.aiUnitTurns)), aiMoveRateWar: r3(move.warMoved / Math.max(1, move.warUnitTurns)), aiMoveRatePeace: r3(move.peaceMoved / Math.max(1, move.peaceUnitTurns)),
      stackTurns: st, stackMovedShare: r3(sum('moved') / Math.max(1, st)), stackShuttleShare: r3(sum('shuttle') / Math.max(1, st)), stackBesiegeShare: r3(sum('besieging') / Math.max(1, st)),
      stackWaitRouteShare: r3(sum('waitRoute') / Math.max(1, st)), stackIdleHomeShare: r3(sum('idleHome') / Math.max(1, st)), stackIdleFieldShare: r3(sum('idleField') / Math.max(1, st)),
      majorsMet,
      // Army size (lane W5 AI armies): land units per AI-major stack at war (all, and away from its own
      // cities), the majors' mean treasury and land units now, their bankruptcies and the player's losses.
      warStackMean: r1(mean(stackSizes)), warStackMedian: median(stackSizes), warFieldStackMean: r1(mean(fieldStackSizes)), warFieldStackMedian: median(fieldStackSizes),
      warWallStackMean: r1(mean(wallStackSizes)), warWallStackMedian: median(wallStackSizes), warWallStackTurns: wallStackSizes.length,
      aiGoldMean: Math.round(mean(aiMajors(s).map((n) => n.economy?.gold || 0))),
      aiUnitsMean: r1(mean(aiMajors(s).map((n) => landUnitsOf(s, n.id)))),
      bankruptcies: tallies.bankruptcies, playerCitiesLost: tallies.playerCitiesLost,
      playerOverext: getOverextension ? Math.round(getOverextension(s, me)) : 0, playerAuthority: authorityOf ? r1(authorityOf(s, me).total) : 0,
      aiTopOverext: top && getOverextension ? Math.round(getOverextension(s, top[0])) : 0, aiTopAuthority: top && authorityOf ? r1(authorityOf(s, top[0]).total) : 0,
      aiTop5OverextMean: top5.length && getOverextension ? r1(mean(top5.map((e) => getOverextension(s, e[0])))) : 0, aiTop5AuthorityMean: top5.length && authorityOf ? r1(mean(top5.map((e) => authorityOf(s, e[0]).total))) : 0,
      telemTurn: t
    };
    delete out.sieges;
    return out;
  };

  const report = (s) => ({
    snapshot: snapshot(s), series, wars: [...wars.values()], warStacks: stackStats, demands: demandOutcome, tallies,
    first: { ...first }
  });

  return { observe, snapshot, report, STACK_KINDS };
};
