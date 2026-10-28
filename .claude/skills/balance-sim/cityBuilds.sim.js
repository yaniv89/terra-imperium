// .claude/skills/balance-sim/cityBuilds.sim.js
// City builds (lane city-builds): how many turns a typical city needs for each thing it can build,
// by the builder's age, and how often a player city sits with nothing to build. Every SAMPLE turns
// every living major's cities are read (cityEconomy.js cityLive and buildQuote, the build list's own
// numbers); rows are grouped by the owner's research age. Per seed one BUILDS line:
//   byAge.<age>: { n (city samples), size, prod (median production), bldg (median turns of the age's
//     own building in each line that has one), bldgMax (p90), inf / cav (the age's infantry and
//     cavalry), settler }
//   idleCityTurns  player city-turns that began with nothing to build (the advisor then fills them)
//   cityTurns      player city-turns in all; idleShare = idleCityTurns / cityTurns
//   KEEP=advisor|repeat  every player city gets that standing order (SET_PRODUCTION_KEEP) once its
//                  first idle turn is counted: idle turns are then only a new city's first turn
//   byAge.<age>.founded  cities majors founded while in that age; .bldDone building tiers finished per
//     city per 10 turns (sample to sample); .newInf infantry turns in cities of size 2 or less
//   KEEP_CAPITAL=1 with KEEP: only the capital gets the order once; new cities inherit it from their settlers' home
//   TURNS=300 SEEDS=11,12 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/cityBuilds.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { turnBlockers } from '../../../src/engine/turnBlockers';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId, ageOf } from '../../../src/engine/nationState';
import { cityLive, buildQuote } from '../../../src/engine/cityEconomy';
import { BUILDING_CATEGORIES } from '../../../src/data/buildings';
import { AGE_ORDER } from '../../../src/data/ages';

const TURNS = Number(process.env.TURNS || 300);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const SIZE = process.env.SIZE || 'standard';
const SAMPLE = Number(process.env.SAMPLE || 10);
const KEEP = process.env.KEEP || null;
const KEEP_CAPITAL = !!process.env.KEEP_CAPITAL;

const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const ageBuildings = (ageId) => Object.entries(BUILDING_CATEGORIES).flatMap(([category, c]) => c.tiers.map((t, tier) => ({ t, tier })).filter(({ t }) => t.age === ageId).map(({ tier }) => ({ kind: 'building', category, tier })));

const tiersOf = (city) => Object.values(city.buildings?.categories || {}).reduce((n, t) => n + (t >= 0 ? t + 1 : 0), 0);
const sample = (s, acc, prev) => {
  Object.values(s.regions).forEach((city) => {
    const owner = city.owner;
    if (!owner || city.outpost || city.razing || city.tile == null || s.nations?.[owner]?.kind === 'independent') return;
    const ageId = ageOf(s, owner);
    const live = cityLive(s, city.id);
    if (!live || !(live.yields.production > 0)) return;
    const row = (acc[ageId] ||= { n: 0, size: [], prod: [], bldg: [], inf: [], cav: [], settler: [], founded: 0, done: 0, doneN: 0, newInf: [] });
    row.n += 1; row.size.push(city.size); row.prod.push(live.yields.production);
    const was = prev.get(city.id);
    if (was === undefined) row.founded += 1; else if (was.owner === owner) { row.done += tiersOf(city) - was.tiers; row.doneN += 1; }
    prev.set(city.id, { owner, tiers: tiersOf(city) });
    const q = (item) => buildQuote(s, city.id, item, live)?.turns;
    ageBuildings(ageId).forEach((item) => { const t = q(item); if (t != null) row.bldg.push(t); });
    row.inf.push(q({ kind: 'unit', classId: 'infantry' }));
    if (city.size <= 2) row.newInf.push(q({ kind: 'unit', classId: 'infantry' }));
    row.cav.push(q({ kind: 'unit', classId: 'cavalry' }));
    row.settler.push(q({ kind: 'settler' }));
  });
};

SEEDS.forEach((seed) => {
  it(`city builds seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: SIZE, seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { ...(s.battleSettings || {}), autoDefend: true } };
    const player = createScriptedPlayer({ engine: { gameReducer, ActionTypes, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId }, production: false });
    const acc = {}; const prev = new Map(); const out = { seed, idleCityTurns: 0, cityTurns: 0 };
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      for (let k = 0; k < 6 && (s.activeEventId || s.activeProceduralEvent); k++) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: k } });
      s = player.answer(s).state;
      const mine = Object.values(s.regions).filter((c) => c.owner === s.playerNationId && !c.outpost && !c.razing);
      out.cityTurns += mine.length;
      const idle = turnBlockers(s).filter((b) => b.kind === 'city').length;
      out.idleCityTurns += idle;
      if (KEEP) mine.filter((c) => !c.production?.keep && (!KEEP_CAPITAL || (c.isCapital && t === 1))).forEach((c) => { s = gameReducer(s, { type: ActionTypes.SET_PRODUCTION_KEEP, payload: { cityId: c.id, keep: KEEP } }); });
      if (turnBlockers(s).some((b) => b.kind === 'city')) s = gameReducer(s, { type: ActionTypes.ADVISOR_PRODUCTION });
      if (t % SAMPLE === 0) sample(s, acc, prev);
      const at = s.turnNumber;
      s = resolveTurn(s);
      if (s.turnNumber === at) { out.stuck = at; break; }
    }
    out.finalTurn = s.turnNumber;
    out.idleShare = Math.round((out.idleCityTurns / Math.max(1, out.cityTurns)) * 1000) / 1000;
    out.byAge = Object.fromEntries(AGE_ORDER.filter((a) => acc[a]).map((a) => {
      const r = acc[a];
      return [a, { n: r.n, size: pct(r.size, 0.5), prod: pct(r.prod, 0.5), bldg: pct(r.bldg, 0.5), bldgMax: pct(r.bldg, 0.9), inf: pct(r.inf, 0.5), cav: pct(r.cav, 0.5), settler: pct(r.settler, 0.5), founded: r.founded, bldDone: Math.round((r.done / Math.max(1, r.doneN)) * (10 / SAMPLE) * 100) / 100, newInf: pct(r.newInf, 0.5) }];
    }));
    console.log(`BUILDS ${JSON.stringify(out)}`);
  });
});
