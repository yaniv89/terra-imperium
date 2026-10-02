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

const LAND_TILES = (() => { const t = getTiles(); let n = 0; for (let i = 0; i < t.count; i++) if (t.land[i] === 1) n += 1; return n; })();

const TURNS = Number(process.env.TURNS || 150);
const EVERY = Number(process.env.EVERY || 50);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'fr';
// SCENARIO=emergent starts the 'emergent civilizations' world (free frontier land, 45 nations).
const SCENARIO = process.env.SCENARIO || 'full';
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

// Campaign invariant violations from the state auditor (src/engine/stateAudit.js): must stay 0.
const auditCount = (s) => { const r = auditGameState(s); return Array.isArray(r) ? r.length : (r?.violations?.length ?? r?.errors?.length ?? (r?.ok === false ? 1 : 0)); };

const snapshot = (s, t, counters, ms) => {
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
    playerProvinces: counts[PLAYER] || 0, playerGold: Math.round(s.resources.gold || 0), playerSupplies: Math.round(s.resources.supplies || 0),
    playerUnits: Object.values(s.units).filter((u) => u.ownerId === PLAYER).length,
    // Research (src/engine/research.js): the player's advisor picks; the median AI nation.
    playerTechs: Object.values(s.techTree).filter((t) => t.researched).length, playerTechAge: s.techAgeId,
    medianAiTechs: (() => { const n = nations.filter((x) => !x.isPlayer && !x.isEliminated).map((x) => (x.tech?.researched || []).length).sort((a, b) => a - b); return n[Math.floor(n.length / 2)] || 0; })(),
    nonFinite, auditViolations: auditCount(s), msPerTurn: +ms.toFixed(1)
  };
};

SEEDS.forEach((seed) => {
  it(`world seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, ...(SCENARIO === 'emergent' ? { scenario: { mode: 'emergent' } } : {}) }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } }; // the passive player lets its advisor pick research
    const counters = { leagues: 0, conquests: 0, changedHands: 0, flips: 0 };
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
      // Cities that changed hands this turn; the ones that did so without a conquest are loyalty flips.
      Object.values(s.regions).forEach((r) => {
        if (owners[r.id] !== undefined && owners[r.id] !== r.owner) { counters.changedHands += 1; if (!r.conquest || r.conquest.turn !== s.turnNumber) counters.flips += 1; }
        owners[r.id] = r.owner;
      });
      if (t % EVERY === 0 || t === TURNS) {
        last = snapshot(s, t, counters, (performance.now() - t0) / turnsSince);
        console.log(`STATS seed=${seed} ${Object.entries(last).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        t0 = performance.now(); turnsSince = 0;
      }
    }
    console.log(`SUMMARY ${JSON.stringify({ seed, ...last })}`);
  });
});
