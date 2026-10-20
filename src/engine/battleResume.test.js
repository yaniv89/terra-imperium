// src/engine/battleResume.test.js
// Playtest 4 C2 and H2: a commanded battle reloaded mid-fight must (1) pick up at its latest
// checkpoint, never at tick 0, and (2) end in the campaign exactly as the screen showed it: the
// verified replay of the whole log (orders before the reload and after it) lands on the live
// battle's own hash and result.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildCommandedSetup, setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { createBattleLoop } from '../battle/worker/battleLoop';
import { deployZone } from '../battle/sim/world';
import { Q } from '../battle/sim/constants';
import { getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities, neighbourWorld } from './testWorld';
import { verifyCommandedBattle } from './battleVerify';
import { resolveActionOf } from './battleReceipt';
import { checkpointFits, safeBattleSetup } from '../components/battle/battleOpenGuard';
import { syncWorldRegistry, keepWorldRegistry } from './world/registry';
import { REGIONS_DATA } from '../data/regions';
import { createWorld } from '../battle/sim/world';
import { worldHash } from '../battle/sim/hash';
import { newerCheckpoint } from '../battle/worker/battleStore';

const WORLD = (() => {
  const base = neighbourWorld({ player: 'ahhiyawa', seed: 1 });
  const me = base.playerNationId;
  const first = addCity(base, me);
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== me) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== me);
  const enemy = first.state.regions[target].owner;
  const grown = addCities(first.state, enemy, 3);
  return { state: grown.state, me, enemy, from: first.cityId, target };
})();
const { me: ME, enemy: ENEMY, from: FROM, target: TARGET } = WORLD;
const GATE = getTouchingIds(FROM).includes(TARGET) ? null : getTiles().neighbors[WORLD.state.regions[TARGET].tile].find((n) => getTiles().land[n] === 1);
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1,
  ...(regionId === FROM && GATE != null ? { tile: GATE } : {})
});
const started = (() => {
  const s = WORLD.state;
  const state = {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: ME, enemy: ENEMY, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }],
    units: {
      a1: unit('a1', FROM, ME), a2: unit('a2', FROM, ME, 'cavalry'), a3: unit('a3', FROM, ME, 'ranged'), a4: unit('a4', FROM, ME),
      d1: unit('d1', TARGET, ENEMY), d2: unit('d2', TARGET, ENEMY, 'ranged', 800)
    }
  };
  return gameReducer(state, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FROM, targetRegionId: TARGET } });
})();
const pb = started.pendingBattle;

// The screen around the battle loop: the same orders at the same ticks whatever page is running it.
// `script(loop, w, side)` is called once per tick and may push orders; it must depend only on the
// world, so the uninterrupted run and the reloaded one give the same orders.
const drive = (loop, messages, { untilTick = Infinity, script }) => {
  const w = loop.world;
  let now = 0;
  loop.frame(now);
  let lastTick = -1;
  for (let f = 0; f < 400000 && !messages.some((m) => m.type === 'ended') && w.tick < untilTick; f++) {
    if (w.tick !== lastTick) { lastTick = w.tick; script(loop, w); }
    now += 50;
    loop.frame(now);
  }
};

const SIDE = buildCommandedSetup(started, pb).controllers.indexOf('player');
const script = (loop, w) => {
  const s = SIDE;
  const army = w.squads.filter((q) => q.side === s && !q.eco && !q.worker && q.alive && q.onField).map((q) => q.idx);
  const keep = w.structures?.[0];
  if (w.tick === 0) {
    const zone = deployZone(w, s);
    loop.pushOrders([{ side: s, type: 'deploy', squads: army, x: Math.round(zone.x1 * Q), y: Math.round(((zone.y0 + zone.y1) / 2) * Q), formation: 'line' }]);
  }
  // Orders before and after the reload point, so the log on both sides of it matters.
  if (keep && (w.tick === 30 || w.tick === 260 || w.tick === 700 || w.tick === 1500)) loop.pushOrders([{ side: s, type: 'attackMove', squads: army, x: keep.x, y: keep.y, formation: 'line' }]);
  if (w.tick === 420) loop.pushOrders([{ side: s, type: 'hold', squads: army.slice(0, 1) }]);
};

describe('a commanded battle reloaded mid-fight (playtest 4 C2, H2)', () => {
  it('resumes at the latest checkpoint and the verified replay equals the live run', () => {
    // 1. The uninterrupted battle, for reference.
    const refMsgs = [];
    const ref = createBattleLoop({ setup: buildCommandedSetup(started, pb), post: (m) => refMsgs.push(m) });
    drive(ref, refMsgs, { script });
    const refEnd = refMsgs.find((m) => m.type === 'ended');
    expect(refEnd).toBeTruthy();

    // 2. The same battle with a reload after the second checkpoint (tick 400 + a bit).
    const msgs = [];
    const first = createBattleLoop({ setup: buildCommandedSetup(started, pb), post: (m) => msgs.push(m) });
    drive(first, msgs, { untilTick: 431, script });
    const cps = msgs.filter((m) => m.type === 'checkpoint');
    expect(cps.length).toBeGreaterThanOrEqual(2);
    const setupKey = setupKeyOf(buildCommandedSetup(started, pb));
    const saved = { ...cps[cps.length - 1], setupVersion: SETUP_VERSION, setupKey };
    // The page reloads: a fresh setup, the saved checkpoint, a fresh loop.
    const freshSetup = buildCommandedSetup(started, pb);
    expect(checkpointFits(saved, freshSetup)).toBe(true);
    const after = [];
    const second = createBattleLoop({ setup: freshSetup, resume: saved, post: (m) => after.push(m) });
    expect(after.some((m) => m.type === 'resumeRejected')).toBe(false);
    expect(second.world.tick).toBe(saved.tick);
    drive(second, after, { script });
    const ended = after.find((m) => m.type === 'ended');
    expect(ended).toBeTruthy();
    // The reloaded battle is the same battle as the uninterrupted one (the orders after the
    // checkpoint and before the reload were lost with the page; the script gives them again).
    expect(ended.hash).toBe(refEnd.hash);

    // 3. The campaign's check: the replay of the whole log lands on the screen's own end.
    const action = resolveActionOf(pb, ended, setupKey);
    const { verification, result } = verifyCommandedBattle(started, pb, action.payload);
    expect(verification.status).toBe('verified');
    expect(verification.hash).toBe(ended.hash);
    expect(verification.tick).toBe(ended.tick);
    expect(result.outcome).toBe(ended.result.outcome);
    const next = gameReducer(started, action);
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.tactical.verification.status).toBe('verified');
  }, 240000);
});

// The cause of both: after a reload the city registry held ANOTHER game's cities (the title screen
// reads the save through migrateSave, which syncs the registry to a fresh game), and the battle
// screen built its setup from it. Same setupKey, another battle: the checkpoint replayed to another
// world (restart from zero) and the campaign's replay, on the synced registry, reached another end.
const otherGame = () => {
  // The same city ids with other facts, as a fresh game on the same world has them.
  const regions = {};
  Object.entries(started.regions).forEach(([id, r]) => { regions[id] = { ...r, isCapital: !r.isCapital }; });
  return { ...started, regions };
};

describe('the battle is set up on its own game after a reload', () => {
  it('a stale registry gives another battle; safeBattleSetup syncs it first', () => {
    const right = buildCommandedSetup(started, pb);
    syncWorldRegistry(otherGame());
    const stale = buildCommandedSetup(started, pb);
    // The bug: another battle (here even another kind of battle: the capital decides it), so the
    // saved checkpoint no longer fits or no longer replays, and the battle restarted from zero.
    expect(`${setupKeyOf(stale)}#${worldHash(createWorld(stale))}`).not.toBe(`${setupKeyOf(right)}#${worldHash(createWorld(right))}`);
    syncWorldRegistry(otherGame());
    const { setup } = safeBattleSetup(started, pb);
    expect(setupKeyOf(setup)).toBe(setupKeyOf(right));
    expect(worldHash(createWorld(setup))).toBe(worldHash(createWorld(right)));
  });

  it('keepWorldRegistry puts the registry back after a side trip into another game', () => {
    syncWorldRegistry(started);
    const before = JSON.stringify(REGIONS_DATA[TARGET]);
    const out = keepWorldRegistry(() => { syncWorldRegistry(otherGame()); return 7; });
    expect(out).toBe(7);
    expect(JSON.stringify(REGIONS_DATA[TARGET])).toBe(before);
    expect(worldHash(createWorld(buildCommandedSetup(started, pb)))).toBe(worldHash(createWorld(safeBattleSetup(started, pb).setup)));
  });
});

describe('a checkpoint taken between ticks (the page hidden)', () => {
  it('orders logged at its tick are applied after the resume, as the replay applies them', () => {
    syncWorldRegistry(started);
    const setup = buildCommandedSetup(started, pb);
    const keep = setup.structures[0];
    const msgs = [];
    const loop = createBattleLoop({ setup, post: (m) => msgs.push(m) });
    const army = () => loop.world.squads.filter((q) => q.side === SIDE && !q.eco && !q.worker && q.alive && q.onField).map((q) => q.idx);
    let now = 0;
    loop.frame(now);
    while (loop.world.tick < 333) { now += 50; loop.frame(now); }
    // Paused, an order waits for the next tick; the page hides and the battle is snapshotted.
    loop.setPaused(true);
    loop.pushOrders([{ side: SIDE, type: 'attackMove', squads: army(), x: keep.x, y: keep.y, formation: 'line' }]);
    loop.snapshot();
    const snap = msgs.filter((m) => m.type === 'snapshot').pop();
    expect(snap.log.some((o) => o.tick === snap.tick)).toBe(true);
    const after = [];
    const resumed = createBattleLoop({ setup: buildCommandedSetup(started, pb), resume: { ...snap, setupVersion: SETUP_VERSION, setupKey: setupKeyOf(setup) }, post: (m) => after.push(m) });
    expect(after.some((m) => m.type === 'resumeRejected')).toBe(false);
    let t = 0;
    resumed.frame(t);
    for (let f = 0; f < 400000 && !after.some((m) => m.type === 'ended'); f++) { t += 50; resumed.frame(t); }
    const ended = after.find((m) => m.type === 'ended');
    const { verification } = verifyCommandedBattle(started, pb, resolveActionOf(pb, ended, setupKeyOf(setup)).payload);
    expect(verification.status).toBe('verified');
    expect(verification.hash).toBe(ended.hash);
  }, 240000);
});

describe('which saved checkpoint a reload resumes', () => {
  it('the newer of the two stores, and an end record over any checkpoint', () => {
    const old = { tick: 200, savedAt: 1 }; const fresh = { tick: 400, savedAt: 2 }; const end = { tick: 100, savedAt: 0, ended: { result: {} } };
    expect(newerCheckpoint(old, fresh)).toBe(fresh);
    expect(newerCheckpoint(fresh, old)).toBe(fresh);
    expect(newerCheckpoint(fresh, end)).toBe(end);
    expect(newerCheckpoint(null, old)).toBe(old);
    expect(newerCheckpoint(null, null)).toBeNull();
  });
});
