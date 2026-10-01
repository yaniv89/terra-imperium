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

const TURNS = Number(process.env.TURNS || 150);
const EVERY = Number(process.env.EVERY || 50);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'fr';
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
    maxProvinceShare: +(Math.max(...Object.values(counts)) / regs.length).toFixed(3),
    topMilitaryToMedian: +(mil[0] / Math.max(1, mil[Math.floor(mil.length / 2)])).toFixed(1),
    avgWarExhaustion: +(we.reduce((a, b) => a + b, 0) / we.length).toFixed(1),
    avgUnrest: +(unrest.reduce((a, b) => a + b, 0) / unrest.length).toFixed(1),
    playerProvinces: counts[PLAYER] || 0, playerGold: Math.round(s.resources.gold || 0), playerSupplies: Math.round(s.resources.supplies || 0),
    playerUnits: Object.values(s.units).filter((u) => u.ownerId === PLAYER).length,
    nonFinite, auditViolations: auditCount(s), msPerTurn: +ms.toFixed(1)
  };
};

SEEDS.forEach((seed) => {
  it(`world seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const counters = { leagues: 0, conquests: 0 };
    let last;
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
      if (t % EVERY === 0 || t === TURNS) {
        last = snapshot(s, t, counters, (performance.now() - t0) / turnsSince);
        console.log(`STATS seed=${seed} ${Object.entries(last).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        t0 = performance.now(); turnsSince = 0;
      }
    }
    console.log(`SUMMARY ${JSON.stringify({ seed, ...last })}`);
  });
});
