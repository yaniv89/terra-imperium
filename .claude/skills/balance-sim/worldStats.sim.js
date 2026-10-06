// .claude/skills/balance-sim/worldStats.sim.js
// Whole-world headless game: TURNS turns of all 240 nations from fixed SEEDS, a passive player who
// accepts free white peaces and refuses anything that costs. Prints one STATS line per checkpoint
// and a final SUMMARY JSON line per seed, so two commits can be compared number for number.
//   TURNS=150 SEEDS=11,12 EVERY=50 PLAYER=fr npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { auditGameState } from '../../../src/engine/stateAudit';
import { getTiles } from '../../../src/data/geo/tiles';
import { worldHealth, kaplanMeier } from '../../../scripts/simStats.mjs';

const LAND_TILES = (() => { const t = getTiles(); let n = 0; for (let i = 0; i < t.count; i++) if (t.land[i] === 1) n += 1; return n; })();

const TURNS = Number(process.env.TURNS || 150);
const EVERY = Number(process.env.EVERY || 50);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'fr';
// SCENARIO=emergent starts the 'emergent civilizations' world (free frontier land, 45 nations).
// SCENARIO=peoples starts a new game's world (phase W0: majors drawn from the 150-people pool,
// SIZE=small|standard|large, the world seed = the seed); PLAYER may be a people id or an old
// country id (mapped through LEGACY_NATION_IDS: au is the Gunditjmara).
const SCENARIO = process.env.SCENARIO || 'full';
const SIZE = process.env.SIZE || 'standard';
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

// Campaign invariant violations from the state auditor (src/engine/stateAudit.js): must stay 0.
const auditCount = (s) => { const r = auditGameState(s); return Array.isArray(r) ? r.length : (r?.violations?.length ?? r?.errors?.length ?? (r?.ok === false ? 1 : 0)); };

// Runaway and health measures (scripts/simStats.mjs): Gini, HHI, effective nations, Zipf slope, all
// shares or indices so they read the same on a denser grid. Survival is Kaplan-Meier over nation
// lifetimes (a revived nation counts as a new life), checked at every EVERY turns.
const isLand = (tile) => getTiles().land[tile] === 1;
const checkpoints = () => { const c = []; for (let t = EVERY; t <= TURNS; t += EVERY) c.push(t); return c; };

const isPlagued = (r) => r.disaster?.kind === 'plague' || (r.plague?.i || 0) > 0;

const snapshot = (s, t, counters, ms, lives) => {
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
    ...worldHealth(s, { isLand, landTiles: LAND_TILES, playerId: s.playerNationId }),
    nationsAliveShare: +kaplanMeier(lives, [t]).at[t].toFixed(3), leadChanges: counters.leadChanges,
    // Plague: cities carrying the 'plague' mark now, and distinct cities struck so far (the old
    // independent roll in cityDisasters.js and the SIR epidemic in plague.js both set the mark).
    plagueCitiesNow: regs.filter(isPlagued).length, plagueCitiesStruck: counters.plagued.size,
    // Independents (phase W1): how many still stand, and the majors' cities (the expansion check).
    independentsAlive: nations.filter((n) => n.kind === 'independent' && !n.isEliminated).length,
    majorCities: regs.filter((r) => r.owner && s.nations[r.owner]?.kind !== 'independent').length,
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
    tradeGold: s.indepStats?.tradeGold || 0, majorTributeDemands: s.indepStats?.tributeDemandsByMajors || 0, tributeToMajors: s.indepStats?.tributeToMajors || 0,
    campaignsRunning: nations.filter((n) => n.indepGoal?.kind === 'conquer' && !n.isEliminated).length,
    nonFinite, auditViolations: auditCount(s), msPerTurn: +ms.toFixed(1)
  };
};

SEEDS.forEach((seed) => {
  it(`world seed ${seed}`, () => {
    const scenario = SCENARIO === 'emergent' ? { scenario: { mode: 'emergent' } } : SCENARIO === 'peoples' ? { scenario: { mode: 'peoples', size: SIZE, seed, ...(process.env.INDEPENDENTS === '0' ? { independents: false } : {}) } } : {};
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, ...scenario }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } }; // the passive player lets its advisor pick research
    const counters = { leagues: 0, conquests: 0, changedHands: 0, flips: 0, civilWars: 0, leadChanges: 0, plagued: new Set() };
    // One life per nation alive at the start; a nation that dies and comes back starts a new life.
    const lives = []; const open = {};
    Object.values(s.nations).forEach((n) => { if (!n.isEliminated) { open[n.id] = { born: 0, died: null }; lives.push(open[n.id]); } });
    let leader = null;
    let inWar = new Set(Object.values(s.nations).filter((n) => n.civilWar?.active).map((n) => n.id));
    let last;
    let owners = Object.fromEntries(Object.values(s.regions).map((r) => [r.id, r.owner]));
    let t0 = performance.now(); let turnsSince = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      const before = s.logs.length;
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      turnsSince += 1;
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
      leader = top;
      if (t % EVERY === 0 || t === TURNS || s.gameStatus !== GameStatus.ACTIVE) {
        // The game ending early (a passive France falls to a siege around turn 100) still prints a
        // final snapshot with its real status, not the last round number's.
        last = snapshot(s, t, counters, (performance.now() - t0) / Math.max(1, turnsSince), lives);
        console.log(`STATS seed=${seed} ${Object.entries(last).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        t0 = performance.now(); turnsSince = 0;
      }
    }
    // Survival curve at each checkpoint (S(t) holds its last value after an early end).
    const km = kaplanMeier(lives, checkpoints());
    const survival = Object.fromEntries(checkpoints().map((c) => [`survivalT${c}`, +km.at[c].toFixed(3)]));
    console.log(`SUMMARY ${JSON.stringify({ seed, ...last, ...survival, medianNationLife: km.median })}`);
  });
});
