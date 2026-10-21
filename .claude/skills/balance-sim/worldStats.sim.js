// .claude/skills/balance-sim/worldStats.sim.js
// Whole-world headless game: TURNS turns of all 240 nations from fixed SEEDS, a passive player who
// accepts free white peaces and refuses anything that costs. Prints one STATS line per checkpoint
// and a final SUMMARY JSON line per seed, so two commits can be compared number for number.
//   TURNS=150 SEEDS=11,12 EVERY=50 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { auditGameState } from '../../../src/engine/stateAudit';
import { getTiles } from '../../../src/data/geo/tiles';
import { RESOURCES_ON_TILES } from '../../../src/data/tileYields';
import { worldHealth, kaplanMeier, rulerStats } from '../../../scripts/simStats.mjs';
import * as RULERS from '../../../src/engine/rulers'; // read through the namespace: a base before U11 has no levels
import { installGeneratedWorld } from '../../../src/worldgen/nodeWorld';
import { createScriptedPlayer, createTelemetry } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { authorityOf } from '../../../src/engine/authority';
import { getOverextension } from '../../../src/engine/nationalPower';
import { metNations } from '../../../src/engine/fog';
import { opinionOf } from '../../../src/engine/opinion';
import { decreeCap } from '../../../src/engine/decrees';
import { isIndependentNation } from '../../../src/data/independents';
import fs from 'node:fs';
import path from 'node:path';

// Land tiles of the world in play (recounted when MAP=generated installs a world per seed).
const countLand = () => { const t = getTiles(); let n = 0; for (let i = 0; i < t.count; i++) if (t.land[i] === 1) n += 1; return n; };
let LAND_TILES = countLand();
// MAP=generated plays each seed on a generated world (plans/MAP-VARIATIONS-PLAN.md 8.2): the map
// seed is the game seed, LAND (default 30) the land share; it plays on a generated map.
const MAP = process.env.MAP || 'earth';
const MAP_LAND = Number(process.env.LAND || 30);
// SHAPE (continents, pangaea, archipelago, islands, inland) and GENVER (the generator version, default the current one).
const MAP_SHAPE = process.env.SHAPE || 'continents';
const MAP_VERSION = process.env.GENVER ? Number(process.env.GENVER) : undefined;

const TURNS = Number(process.env.TURNS || 150);
const EVERY = Number(process.env.EVERY || 50);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
// Every run is a new game's peoples world (majors drawn from the 150-people pool; SIZE=small|standard|large,
// the world seed = the seed); PLAYER is a people id.
const SIZE = process.env.SIZE || 'standard';
// POLICY=passive (default, the old harness) | scripted (answers every blocker and queues what an AI
// would build in the player's idle cities and sends its settlers to the best site; scripts/campaignTelemetry.mjs). DEMANDS=refuse (default) |
// pay for the scripted player's answer to a major's demand and to an independent's tribute demand.
// SPEED=normal|marathon|... is the game speed. OUT_DIR=dir also writes telemetry-<seed>.json (series,
// wars, tribute answers, stack verdicts); TRACE_WARS=1 with OUT_DIR writes warstacks-<seed>.jsonl,
// one row per AI stack per war per turn (why a stack waits or shuttles).
const POLICY = process.env.POLICY || 'passive';
// RUSH=1 with POLICY=scripted: the scripted player also buys production with gold (spending.js,
// lane CB04). Loaded lazily so the harness still runs on a commit without spending.js.
const RUSH = process.env.RUSH === '1';
const SPENDING = RUSH ? await import('../../../src/engine/spending').catch(() => null) : null;
const DEMANDS = process.env.DEMANDS || 'refuse';
const SPEED = process.env.SPEED || null;
const OUT_DIR = process.env.OUT_DIR || '';
const TRACE_WARS = process.env.TRACE_WARS === '1' && !!OUT_DIR;
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

// Campaign invariant violations from the state auditor (src/engine/stateAudit.js): must stay 0.
const auditCount = (s) => { const r = auditGameState(s); return Array.isArray(r) ? r.length : (r?.violations?.length ?? r?.errors?.length ?? (r?.ok === false ? 1 : 0)); };

// Runaway and health measures (scripts/simStats.mjs): Gini, HHI, effective nations, Zipf slope, all
// shares or indices so they read the same on a denser grid. Survival is Kaplan-Meier over nation
// lifetimes (a revived nation counts as a new life), checked at every EVERY turns.
const isLand = (tile) => getTiles().land[tile] === 1;
const checkpoints = () => { const c = []; for (let t = EVERY; t <= TURNS; t += EVERY) c.push(t); return c; };

const isPlagued = (r) => r.disaster?.kind === 'plague' || (r.plague?.i || 0) > 0;

// Ages (eight-ages plan U17): a nation's age as the engine under test sees it. An old engine (a
// base commit) still had the calendar floor and the +1 cap; the ages-by-tech engine has only research.
const nationAge = (s, id) => (AGES.getEffectiveAgeId ? AGES.getEffectiveAgeId(s.age, getTechAgeId(s, id)) : getTechAgeId(s, id));
const livingMajors = (s) => Object.values(s.nations).filter((n) => n.kind !== 'independent' && !n.isEliminated && !n.id.startsWith('free_') && n.id !== 'rebels');
// The plan's target end turn of each age by speed (KTD9, Bronze to Gunpowder; Modern runs to the end).
const AGE_TARGET_TURNS = { fast: { bronze: 24, classical: 52, kingdoms: 84, gunpowder: 80 }, normal: { bronze: 48, classical: 109, kingdoms: 167, gunpowder: 200 }, marathon: { bronze: 120, classical: 260, kingdoms: 334, gunpowder: 400 } };
const ageTargetEnds = (speed) => { const t = AGE_TARGET_TURNS[speed] || AGE_TARGET_TURNS.normal; let sum = 0; return Object.fromEntries(Object.entries(t).map(([a, n]) => { sum += n; return [a, sum]; })); };
const ageStats = (s, counters) => {
  const idx = livingMajors(s).map((n) => AGES.getAgeIndex(nationAge(s, n.id))).sort((a, b) => a - b);
  const median = idx[Math.floor(idx.length / 2)] ?? 0;
  const leader = idx[idx.length - 1] ?? 0;
  const out = { medianMajorAgeIndex: median, leaderAgeIndex: leader, leaderAgeGap: leader - median };
  AGES.AGE_ORDER.forEach((a, i) => { out[`ageShare_${a}`] = +(idx.filter((x) => x === i).length / Math.max(1, idx.length)).toFixed(3); });
  Object.entries(counters.pastAt || {}).forEach(([k, v]) => { out[k] = v; });
  return out;
};

// Ambitions (differentiation plan U12): fulfilled per age entered (ages = the nation's age index + 1),
// the AI majors' mean beside the player's; ambitionsDone sums every major. Empty on a base without them.
const ambitionStats = (s) => {
  const rate = (n) => (n.ambitions?.done?.length || 0) / (AGES.getAgeIndex(nationAge(s, n.id)) + 1);
  const majors = livingMajors(s).filter((n) => n.ruler);
  if (!majors.some((n) => n.ambitions)) return {};
  const ai = majors.filter((n) => n.id !== s.playerNationId);
  const me = s.nations[s.playerNationId];
  return {
    ambitionsDone: majors.reduce((a, n) => a + (n.ambitions?.done?.length || 0), 0),
    ambitionsPerMajorAge: +(ai.reduce((a, n) => a + rate(n), 0) / Math.max(1, ai.length)).toFixed(2),
    playerAmbitionsPerAge: me?.ambitions ? +rate(me).toFixed(2) : null
  };
};

const snapshot = (s, t, counters, ms, lives, telemetry) => {
  const regs = Object.values(s.regions);
  const nations = Object.values(s.nations);
  const counts = {}; regs.forEach((r) => { counts[r.owner] = (counts[r.owner] || 0) + 1; });
  const vassals = nations.filter((n) => n.vassalOf);
  const we = nations.map((n) => n.warExhaustion || 0);
  const unrest = regs.map((r) => r.unrest || 0);
  const dev = regs.filter((r) => (r.devastation || 0) > 0);
  const mil = nations.map((n) => n.militaryStrength || 0).sort((a, b) => b - a);
  const nonFinite = [...Object.values(s.resources), ...mil, ...regs.map((r) => r.currentPopulation)].filter((v) => typeof v === 'number' && !Number.isFinite(v)).length;
  return {
    turn: t, year: s.year, status: s.gameStatus,
    warsActive: s.wars.filter((w) => w.active).length, warsTotal: s.wars.length,
    independenceWars: s.wars.filter((w) => w.cb === 'independence').length,
    pactWars: s.wars.filter((w) => w.cb === 'defensivePact').length,
    pactMembers: nations.filter((n) => n.defensivePact).length, leaguesFormed: counters.leagues,
    vassals: vassals.length, avgLibertyDesire: +(vassals.reduce((a, n) => a + (n.libertyDesire || 0), 0) / Math.max(1, vassals.length)).toFixed(1),
    conquests: counters.conquests, devastatedProvinces: dev.length,
    civilWarsStarted: counters.civilWars, inCivilWar: nations.filter((n) => n.civilWar?.active).length, rebelStacks: Object.values(s.units).filter((u) => u.ownerId === 'rebels').length,
    // The tile world (plans/civ-map-rework.md Part H): land claimed, cities, hands changed, flips.
    cities: regs.length, landClaimedPct: +(100 * Object.keys(s.world?.tileOwner || {}).filter((t) => getTiles().land[t] === 1).length / LAND_TILES).toFixed(1),
    citiesChangedHands: counters.changedHands, loyaltyFlips: counters.flips, freeCities: regs.filter((r) => r.owner === null && r.freeCity).length,
    sieges: regs.filter((r) => r.siege?.by).length, armiesOnRoad: Object.values(s.units).filter((u) => u.route?.length).length,
    maxProvinceShare: +(Math.max(...Object.entries(counts).filter(([o]) => o !== 'null').map(([, c]) => c)) / regs.length).toFixed(3),
    // Land growth: the biggest and the median living nation, and the land nobody holds yet.
    topNationProvinces: Math.max(...Object.entries(counts).filter(([o]) => o !== 'null').map(([, c]) => c)),
    medianNationProvinces: (() => { const c = Object.entries(counts).filter(([o]) => o !== 'null').map(([, v]) => v).sort((a, b) => a - b); return c[Math.floor(c.length / 2)] || 0; })(),
    unclaimedProvinces: counts.null || 0,
    topMilitaryToMedian: +(mil[0] / Math.max(1, mil[Math.floor(mil.length / 2)])).toFixed(1),
    avgWarExhaustion: +(we.reduce((a, b) => a + b, 0) / we.length).toFixed(1),
    avgUnrest: +(unrest.reduce((a, b) => a + b, 0) / unrest.length).toFixed(1),
    playerProvinces: counts[s.playerNationId] || 0, playerGold: Math.round(s.resources.gold || 0), playerSupplies: Math.round(s.resources.supplies || 0),
    playerUnits: Object.values(s.units).filter((u) => u.ownerId === s.playerNationId).length,
    // Research (src/engine/research.js): the player's advisor picks; the median AI nation.
    playerTechs: Object.values(s.techTree).filter((t) => t.researched).length, playerTechAge: s.techAgeId,
    medianAiTechs: (() => { const n = nations.filter((x) => !x.isPlayer && !x.isEliminated).map((x) => (x.tech?.researched || []).length).sort((a, b) => a - b); return n[Math.floor(n.length / 2)] || 0; })(),
    // Per-city normalised versions of the count keys above, for a denser grid or more cities.
    devastatedShare: +(dev.length / Math.max(1, regs.length)).toFixed(3), unclaimedShare: +((counts.null || 0) / Math.max(1, regs.length)).toFixed(3),
    ...(telemetry ? telemetry.snapshot(s) : {}),
    ...worldHealth(s, { isLand, landTiles: LAND_TILES, playerId: s.playerNationId }),
    ...(RULERS.rulerLevel ? rulerStats(s.nations, { levelOf: (r) => RULERS.rulerLevel(r.renown), pointsOf: RULERS.rulerPoints, branchOf: (v) => RULERS.VIRTUES[v]?.branch, playerId: s.playerNationId }) : {}),
    ...ambitionStats(s),
    nationsAliveShare: +kaplanMeier(lives, [t]).at[t].toFixed(3), leadChanges: counters.leadChanges,
    // Plague: cities carrying the 'plague' mark now, and distinct cities struck so far (the old
    // independent roll in cityDisasters.js and the SIR epidemic in plague.js both set the mark).
    plagueCitiesNow: regs.filter(isPlagued).length, plagueCitiesStruck: counters.plagued.size,
    // Independents (phase W1): how many still stand, and the majors' cities (the expansion check).
    independentsAlive: nations.filter((n) => n.kind === 'independent' && !n.isEliminated).length,
    majorsAlive: nations.filter((n) => n.kind !== 'independent' && !n.isEliminated && !n.id.startsWith('free_')).length,
    majorCities: regs.filter((r) => r.owner && s.nations[r.owner]?.kind !== 'independent').length,
    // Techs of the median AI major (medianAiTechs above counts the independents too), and AI sallies (I125).
    medianMajorTechs: (() => { const n = nations.filter((x) => !x.isPlayer && !x.isEliminated && x.kind !== 'independent' && !x.id.startsWith('free_') && x.id !== 'rebels').map((x) => (x.tech?.researched || []).length).sort((a, b) => a - b); return n[Math.floor(n.length / 2)] || 0; })(),
    sallies: s.indepStats?.sallies || 0, salliesIndep: s.indepStats?.salliesIndep || 0, salliesWon: s.indepStats?.salliesWon || 0,
    // Resource tiles held by AI majors that carry their improvement (the AI builds them, lane W6).
    aiResImprovedShare: (() => { const tl = getTiles(); if (!tl.resourceOf) return 0; let have = 0; let done = 0; for (const [t, cid] of Object.entries(s.world?.tileOwner || {})) { const o = s.regions[cid]?.owner; if (!o || o === s.playerNationId || s.nations[o]?.kind === 'independent') continue; const r = RESOURCES_ON_TILES[tl.resourceOf(+t)]; if (!r) continue; have += 1; const st = s.world.tileState?.[t]; if (st?.improvement === r.improvement && !st.pillaged) done += 1; } return +(done / Math.max(1, have)).toFixed(3); })(),
    // Unrest sources (lane W6): the majors' mean overextension (unrest -overext/20 a turn), city size
    // (amenity need), the share of major cities with unrest at or over 50, and unrest in majors only.
    aiOverextMean: (() => { const ms = nations.filter((n) => n.kind !== 'independent' && !n.isEliminated && !n.id.startsWith('free_') && n.id !== 'rebels' && n.id !== s.playerNationId); return +(ms.reduce((a, n) => a + getOverextension(s, n.id), 0) / Math.max(1, ms.length)).toFixed(1); })(),
    majorCitySizeMean: (() => { const c = regs.filter((r) => r.owner && !r.outpost && s.nations[r.owner] && s.nations[r.owner].kind !== 'independent'); return +(c.reduce((a, r) => a + (r.size || 0), 0) / Math.max(1, c.length)).toFixed(2); })(),
    majorUnrestMean: (() => { const c = regs.filter((r) => r.owner && !r.outpost && s.nations[r.owner] && s.nations[r.owner].kind !== 'independent'); return +(c.reduce((a, r) => a + (r.unrest || 0), 0) / Math.max(1, c.length)).toFixed(2); })(),
    indepUnrestMean: (() => { const c = regs.filter((r) => r.owner && s.nations[r.owner]?.kind === 'independent'); return +(c.reduce((a, r) => a + (r.unrest || 0), 0) / Math.max(1, c.length)).toFixed(2); })(),
    // Cities per AI major (outposts not counted, the player left out), and the player's buildings.
    citiesPerAiMajor: (() => { const ms = new Set(nations.filter((n) => n.kind !== 'independent' && !n.isEliminated && !n.id.startsWith('free_') && n.id !== 'rebels' && n.id !== s.playerNationId).map((n) => n.id)); const c = regs.filter((r) => r.owner && !r.outpost && ms.has(r.owner)).length; return +(c / Math.max(1, ms.size)).toFixed(2); })(),
    playerBuildings: regs.filter((r) => r.owner === s.playerNationId).reduce((a, c) => a + Object.values(c.buildings?.categories || {}).reduce((k, v) => k + (Number.isFinite(v) ? v + 1 : 0), 0), 0),
    // Action gaps (I029): turns on which the scripted player had a decision (a city to queue, a
    // settler to send, a tech done, a blocker to answer); the longest run of turns without one.
    ...(counters.actions ? { actionTurnShare: +(counters.actions.turns / Math.max(1, t)).toFixed(3), maxActionGap: counters.actions.maxGap, actionGapsOver5: counters.actions.over5, actionTurnShare100: +(counters.actions.turns100 / Math.max(1, Math.min(100, t))).toFixed(3), maxActionGap100: counters.actions.maxGap100 } : {}),
    // Independents' AI (phase W2, raids.js, cumulative): raids started (and at the player), raids
    // that took their loot (and on the player), raid battles, sacks, loot, tribute demands and deals,
    // tribute gold paid, mercenary bands hired; and now: raids out, tribute deals running, bands in service.
    raidsStarted: s.indepStats?.raidsStarted || 0, raidsAtPlayer: s.indepStats?.raidsAtPlayer || 0, raidsHit: s.indepStats?.raidsHit || 0,
    raidsOnPlayer: s.indepStats?.raidsOnPlayer || 0, raidBattles: s.indepStats?.raidBattles || 0, sacks: s.indepStats?.sacks || 0,
    raidLoot: s.indepStats?.loot || 0, tributeDemands: s.indepStats?.tributeDemands || 0, tributeDeals: s.indepStats?.tributeDeals || 0,
    tributeGold: s.indepStats?.tributeGold || 0, mercsHired: s.indepStats?.mercsHired || 0,
    pillages: s.indepStats?.pillages || 0, routesCut: s.indepStats?.routesCut || 0, settlersKilled: s.indepStats?.settlersKilled || 0, outpostsBurned: s.indepStats?.outpostsBurned || 0,
    raidsOut: nations.filter((n) => n.indep?.raid && !n.isEliminated).length,
    tributeRunning: nations.reduce((k, n) => k + Object.keys(n.indep?.tributeFrom || {}).length, 0),
    mercsActive: Object.values(s.units).filter((u) => u.mercenary).length,
    // Majors and independents (phase W3, indepPolicy.js and razing.js, cumulative): independents
    // conquered, joined, cities razed (and fires started), campaigns, courtships and gifts, trade
    // deals and their gold, tribute demanded by majors and paid to them; and now: campaigns running.
    indepConquered: s.indepStats?.conquered || 0, indepJoined: s.indepStats?.joined || 0, citiesRazed: s.indepStats?.razed || 0, razeStarted: s.indepStats?.razeStarted || 0,
    campaigns: s.indepStats?.campaigns || 0, musters: s.indepStats?.musters || 0, courtships: s.indepStats?.courtships || 0, gifts: s.indepStats?.gifts || 0, tradeDeals: s.indepStats?.tradeDeals || 0,
    tradeGold: s.indepStats?.tradeGold || 0, majorTributeDemands: s.indepStats?.tributeDemandsByMajors || 0, tributeToMajors: s.indepStats?.tributeToMajors || 0, patrons: s.indepStats?.patrons || 0,
    campaignsRunning: nations.filter((n) => n.indepGoal?.kind === 'conquer' && !n.isEliminated).length,
    ...ageStats(s, counters), maxLeaderGap: counters.maxLeaderGap || 0, leaderGapOver1Share: +((counters.gapOver1 || 0) / Math.max(1, counters.gapTurns || 1)).toFixed(3),
    nonFinite, auditViolations: auditCount(s), auditCodes: (() => { const r = auditGameState(s); return Array.isArray(r) && r.length ? r.slice(0, 4).map((x) => `${x.code}:${x.path}`).join(',') : 'none'; })(), msPerTurn: +ms.toFixed(1)
  };
};

SEEDS.forEach((seed) => {
  it(`world seed ${seed}`, () => {
    let map = null; let mapReport = null;
    if (MAP === 'generated') { const w = installGeneratedWorld({ seed, generatorVersion: MAP_VERSION, params: { land: MAP_LAND, shape: MAP_SHAPE } }); map = w.spec; mapReport = w.report; LAND_TILES = countLand(); }
    const scenario = { scenario: { mode: 'peoples', size: SIZE, seed, ...(map ? { map } : {}), ...(process.env.INDEPENDENTS === '0' ? { independents: false } : {}) } };
    if (mapReport) console.log(`MAP seed=${seed} hash=${mapReport.worldHash} continents=${mapReport.continents} startMin=${mapReport.startMin} startMedian=${mapReport.startMedian} startSpread=${mapReport.startSpread.toFixed(3)} repairs=${mapReport.startRepairs}`);
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, ...scenario, ...(SPEED ? { gameSpeed: SPEED } : {}) }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    if (OUT_DIR) fs.mkdirSync(OUT_DIR, { recursive: true });
    const traceStream = TRACE_WARS ? fs.openSync(path.join(OUT_DIR, `warstacks-${seed}.jsonl`), 'w') : null;
    const scripted = POLICY === 'scripted' ? createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult, rushQuote: SPENDING?.rushQuote }, demands: DEMANDS, rush: RUSH, opinionOf }) : null;
    const telemetry = createTelemetry({ playerId: s.playerNationId, isIndependent: isIndependentNation, authorityOf, getOverextension, metNations, getTiles, traceFile: TRACE_WARS, writeLine: traceStream == null ? null : (line) => fs.writeSync(traceStream, line + '\n') });
    let telemMs = 0;
    s = { ...s, research: { ...s.research, auto: true } }; // the passive player lets its advisor pick research
    const counters = { leagues: 0, conquests: 0, changedHands: 0, flips: 0, civilWars: 0, leadChanges: 0, plagued: new Set(), pastAt: {}, actions: scripted ? { turns: 0, turns100: 0, gap: 0, maxGap: 0, maxGap100: 0, over5: 0, techsPrev: null } : null };
    const logSum = (l) => l.queued + l.settled + l.events + l.peace + l.defenses + l.joins + l.demands.length + l.tribute.length + (l.rushes || 0);
    const techCount = (st) => Object.values(st.techTree || {}).filter((x) => x.researched).length;
    // One life per nation alive at the start; a nation that dies and comes back starts a new life.
    const lives = []; const open = {};
    Object.values(s.nations).forEach((n) => { if (!n.isEliminated) { open[n.id] = { born: 0, died: null }; lives.push(open[n.id]); } });
    let leader = null;
    let inWar = new Set(Object.values(s.nations).filter((n) => n.civilWar?.active).map((n) => n.id));
    let last;
    let owners = Object.fromEntries(Object.values(s.regions).map((r) => [r.id, r.owner]));
    let t0 = performance.now(); let turnsSince = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      const acted0 = scripted ? logSum(scripted.log) : 0;
      if (scripted) s = scripted.answer(s).state;
      if (counters.actions) {
        // A decision this turn: anything the scripted player answered, queued or bought, or a tech
        // finished last turn (the next pick).
        const a = counters.actions; const tc = techCount(s);
        const acted = logSum(scripted.log) > acted0 || (a.techsPrev != null && tc > a.techsPrev);
        a.techsPrev = tc;
        if (acted) { a.turns += 1; if (t <= 100) a.turns100 += 1; if (a.gap > 5) a.over5 += 1; a.gap = 0; } else { a.gap += 1; a.maxGap = Math.max(a.maxGap, a.gap); if (t <= 100) a.maxGap100 = Math.max(a.maxGap100, a.gap); }
      }
      else if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      const before = s.logs.length;
      const pre = s;
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      const tm0 = performance.now(); telemetry.observe(pre, s); telemMs += performance.now() - tm0;
      turnsSince += 1;
      // The share of living majors past an age at that age's target end turn (SC4); the leader gap
      // over the median at every checkpoint is in ageStats (SC5).
      const ends = ageTargetEnds(s.gameSpeed);
      Object.entries(ends).forEach(([a, end]) => {
        if (t !== end) return;
        const ms = livingMajors(s);
        counters.pastAt[`pastAt_${a}`] = +(ms.filter((n) => AGES.getAgeIndex(nationAge(s, n.id)) > AGES.getAgeIndex(a)).length / Math.max(1, ms.length)).toFixed(3);
      });
      const gap = ageStats(s, { pastAt: {} }).leaderAgeGap;
      counters.maxLeaderGap = Math.max(counters.maxLeaderGap || 0, gap);
      counters.gapOver1 = (counters.gapOver1 || 0) + (gap > 1 ? 1 : 0);
      counters.gapTurns = (counters.gapTurns || 0) + 1;
      s.logs.slice(before).forEach((l) => {
        if (/defensive league/.test(l.message)) counters.leagues += 1;
        if (/conquers|is conquered|storms/.test(l.message)) counters.conquests += 1;
      });
      // Civil wars that began this turn (plans/playtest-1.md P4).
      const nowInWar = new Set(Object.values(s.nations).filter((n) => n.civilWar?.active).map((n) => n.id));
      nowInWar.forEach((id) => { if (!inWar.has(id)) counters.civilWars += 1; });
      inWar = nowInWar;
      Object.values(s.nations).forEach((n) => {
        if (n.isEliminated && open[n.id]) { open[n.id].died = t; delete open[n.id]; }
        else if (!n.isEliminated && !open[n.id]) { open[n.id] = { born: t, died: null }; lives.push(open[n.id]); }
      });
      // Cities that changed hands this turn; the ones that did so without a conquest are loyalty flips.
      Object.values(s.regions).forEach((r) => {
        if (owners[r.id] !== undefined && owners[r.id] !== r.owner) { counters.changedHands += 1; if (!r.conquest || r.conquest.turn !== s.turnNumber) counters.flips += 1; }
        owners[r.id] = r.owner;
        if (isPlagued(r)) counters.plagued.add(r.id);
      });
      // Lead changes: the nation with the most cities (ties keep the old leader).
      const byOwner = {}; Object.values(s.regions).forEach((r) => { if (r.owner != null) byOwner[r.owner] = (byOwner[r.owner] || 0) + 1; });
      const top = Object.entries(byOwner).reduce((best, e) => (e[1] > best[1] || (e[1] === best[1] && e[0] === leader) ? e : best), [null, -1])[0];
      if (leader != null && top !== leader) counters.leadChanges += 1;
      // Decrees this turn (decrees.js decreeLog, newest first; U6, U8): deeds versus the trickle floor,
      // decrees spent on acts of state, and AI major-turns spent with a full bank.
      counters.decrees ||= { heads: new Map(), deeds: 0, trickle: 0, spent: 0, full: 0, majorTurns: 0, laws: new Map(), lawChanges: 0, govs: new Map(), govChanges: 0 };
      Object.values(s.nations).forEach((n) => {
        const log = n.ruler?.decreeLog || []; const head = counters.decrees.heads.get(n.id);
        for (const e of log) { if (e === head) break; if (e.deed) counters.decrees[e.deed === 'trickle' ? 'trickle' : 'deeds'] += 1; else if (e.n < 0) { counters.decrees.spent -= e.n; counters.decrees.acts = counters.decrees.acts || {}; counters.decrees.acts[e.act] = (counters.decrees.acts[e.act] || 0) + 1; } }
        counters.decrees.heads.set(n.id, log[0]);
        if (n.ruler && !n.isEliminated && n.kind !== 'independent' && n.id !== s.playerNationId) {
          counters.decrees.majorTurns += 1; if ((n.ruler.decrees || 0) >= decreeCap(n)) counters.decrees.full += 1;
          // Acts of state, counted the same way before and after the pools went (U8): law and government changes.
          const laws = JSON.stringify(n.laws || {}); const gov = JSON.stringify(n.government || null);
          if (counters.decrees.laws.has(n.id) && counters.decrees.laws.get(n.id) !== laws) counters.decrees.lawChanges += 1;
          if (counters.decrees.govs.has(n.id) && counters.decrees.govs.get(n.id) !== gov) counters.decrees.govChanges += 1;
          counters.decrees.laws.set(n.id, laws); counters.decrees.govs.set(n.id, gov);
          const claiming = (n.claimsInProgress || []).length; counters.decrees.claims = (counters.decrees.claims || 0) + Math.max(0, claiming - (counters.decrees.claiming?.get(n.id) || 0)); (counters.decrees.claiming ||= new Map()).set(n.id, claiming);
        }
      });
      leader = top;
      if (t % EVERY === 0 || t === TURNS || s.gameStatus !== GameStatus.ACTIVE) {
        // The game ending early (a passive France falls to a siege around turn 100) still prints a
        // final snapshot with its real status, not the last round number's.
        last = snapshot(s, t, counters, (performance.now() - t0 - telemMs) / Math.max(1, turnsSince), lives, telemetry);
        last = { ...last, decreeDeeds: counters.decrees.deeds, decreeTrickle: counters.decrees.trickle, decreeDeedShare: +(counters.decrees.deeds / Math.max(1, counters.decrees.deeds + counters.decrees.trickle)).toFixed(3), decreeSpent: counters.decrees.spent, aiLawChanges: counters.decrees.lawChanges, aiGovChanges: counters.decrees.govChanges, aiClaimsStarted: counters.decrees.claims || 0, aiDevTotal: Object.values(s.regions).reduce((a, r) => a + (r.owner && r.owner !== s.playerNationId && r.dev ? (r.dev.tax || 0) + (r.dev.production || 0) + (r.dev.manpower || 0) : 0), 0), ...Object.fromEntries(Object.entries(counters.decrees.acts || {}).map(([k, v]) => [`act_${k}`, v])), decreeFullShare: +(counters.decrees.full / Math.max(1, counters.decrees.majorTurns)).toFixed(3) };
        if (RUSH && scripted) last = { ...last, playerRushes: scripted.log.rushes || 0, playerRushGold: scripted.log.rushGold || 0 };
        console.log(`STATS seed=${seed} ${Object.entries(last).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        t0 = performance.now(); turnsSince = 0; telemMs = 0;
      }
    }
    // Survival curve at each checkpoint (S(t) holds its last value after an early end).
    const km = kaplanMeier(lives, checkpoints());
    const survival = Object.fromEntries(checkpoints().map((c) => [`survivalT${c}`, +km.at[c].toFixed(3)]));
    console.log(`SUMMARY ${JSON.stringify({ seed, policy: POLICY, ...last, ...survival, medianNationLife: km.median })}`);
    if (traceStream != null) fs.closeSync(traceStream);
    if (OUT_DIR) {
      const rep = telemetry.report(s);
      const warsOnPlayerStarts = rep.wars.filter((w) => w.e === s.playerNationId).map((w) => ({ from: w.a, start: w.start }));
      const demands = [...(scripted ? scripted.log.demands : []), ...(scripted ? scripted.log.tribute : [])].map((d) => ({ ...d, warWithin10: warsOnPlayerStarts.some((w) => w.from === d.from && w.start > d.turn && w.start <= d.turn + 10) }));
      fs.writeFileSync(path.join(OUT_DIR, `telemetry-${seed}.json`), JSON.stringify({ seed, policy: POLICY, demandsPolicy: DEMANDS, speed: SPEED || 'default', player: s.playerNationId, finalTurn: s.turnNumber, status: s.gameStatus, ...rep, demandsAnswered: demands, scriptedLog: scripted ? { ...scripted.log, demands: undefined, tribute: undefined } : null }));
    }
  });
});
