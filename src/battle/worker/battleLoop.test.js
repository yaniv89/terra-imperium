// The real-time loop and the headless replay must agree exactly: a battle played live (orders
// arriving at arbitrary wall-clock moments, pauses, speed changes) replays to the identical final
// world from (setup, recorded log) — what save/resume and multiplayer verification rely on.
import { describe, it, expect } from 'vitest';
import { createBattleLoop, replayTo } from './battleLoop';
import { runHeadless } from '../sim/headless';
import { createWorld } from '../sim/world';
import { worldHash } from '../sim/hash';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { Q } from '../sim/constants';

const mk = (p, cls) => cls.map((c, i) => ({ id: `${p}${i}`, classId: c, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], domain: 'land' }));
const makeSetup = () => buildSetupFromArmies({ regionId: 'loop-test', terrain: 'mixed', seed: 99, attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged', 'siege']), defenderUnits: mk('d', ['infantry', 'ranged', 'infantry']), fortLevel: 2, deposits: ['iron'], controllers: ['player', 'ai'] });

describe('battle loop', () => {
  it('a live-played battle replays to the same final world from its log', () => {
    const messages = [];
    const loop = createBattleLoop({ setup: makeSetup(), post: (m) => messages.push(m) });
    let now = 0;
    const advance = (ms) => { for (let t = 0; t < ms; t += 16) { now += 16; loop.frame(now); } };
    loop.frame(now);
    loop.pushOrders([{ side: 0, type: 'attackMove', squads: [0, 1, 2, 3], x: 70 * Q, y: 30 * Q }]);
    advance(3000);
    loop.setSpeed(2);
    loop.pushOrders([{ side: 0, type: 'attack', squads: [4], target: { kind: 'structure', index: 0 } }]);
    advance(2000);
    loop.setPaused(true);
    loop.pushOrders([{ side: 0, type: 'formationLine', squads: [0, 1], x: 60 * Q, y: 20 * Q, x2: 60 * Q, y2: 36 * Q }]);
    advance(500);
    loop.setPaused(false);
    for (let i = 0; i < 20000 && !messages.some((m) => m.type === 'ended'); i++) { now += 16; loop.frame(now); }
    const ended = messages.find((m) => m.type === 'ended');
    expect(ended).toBeTruthy();
    const replay = runHeadless(makeSetup(), { orders: ended.log });
    expect(replay.hash).toBe(ended.hash);
    expect(replay.result).toEqual(ended.result);
  });

  it('resumes mid-battle from a checkpoint log exactly where it left off', () => {
    const messages = [];
    const loop = createBattleLoop({ setup: makeSetup(), post: (m) => messages.push(m) });
    let now = 0;
    loop.frame(now);
    loop.pushOrders([{ side: 0, type: 'attackMove', squads: [0, 1, 2], x: 70 * Q, y: 30 * Q }]);
    while (!messages.some((m) => m.type === 'checkpoint')) { now += 16; loop.frame(now); }
    const cp = messages.find((m) => m.type === 'checkpoint');
    const resumed = replayTo(createWorld(makeSetup()), cp.log, cp.tick);
    expect(resumed.tick).toBe(cp.tick);
    expect(worldHash(resumed)).toBe(cp.hash);
    // The loop itself resumes it (no rejection) at the checkpoint's tick.
    const posts = [];
    const again = createBattleLoop({ setup: makeSetup(), resume: cp, post: (m) => posts.push(m) });
    expect(posts.some((m) => m.type === 'resumeRejected')).toBe(false);
    expect(again.world.tick).toBe(cp.tick);
  });

  // The frozen empty battle (phone playtest): battle ids repeat between games (b_<turn>_<counter>),
  // so a checkpoint another battle left behind could be replayed into this one.
  it('a checkpoint of another battle is rejected: the battle starts fresh at deployment', () => {
    const messages = [];
    const loop = createBattleLoop({ setup: makeSetup(), post: (m) => messages.push(m) });
    let now = 0;
    loop.frame(now);
    loop.pushOrders([{ side: 0, type: 'attackMove', squads: [0, 1, 2], x: 70 * Q, y: 30 * Q }]);
    while (!messages.some((m) => m.type === 'checkpoint')) { now += 16; loop.frame(now); }
    const stale = messages.find((m) => m.type === 'checkpoint');
    const other = buildSetupFromArmies({ regionId: 'another-city', terrain: 'plains', seed: 7, attackerUnits: mk('x', ['infantry']), defenderUnits: mk('y', ['infantry', 'ranged']), controllers: ['player', 'ai'] });
    const posts = [];
    const fresh = createBattleLoop({ setup: other, resume: stale, post: (m) => posts.push(m) });
    expect(posts.find((m) => m.type === 'resumeRejected')).toMatchObject({ tick: stale.tick });
    expect(fresh.world.tick).toBe(0);
    expect(worldHash(fresh.world)).toBe(worldHash(createWorld(other)));
    // and it plays on normally from there
    fresh.frame(0); fresh.frame(200);
    expect(posts.some((m) => m.type === 'frame')).toBe(true);
  });

  // Playtest audit CB01: the live loop admits orders through the schema the replay uses
  // (sim/orderSchema.js), so the log holds exactly what was applied and nothing else.
  it('admits orders through the shared schema: junk is refused and told, the side is forced, the log is what ran', () => {
    const messages = [];
    const loop = createBattleLoop({ setup: makeSetup(), post: (m) => messages.push(m) });
    loop.frame(0);
    loop.pushOrders([
      { side: 1, type: 'retreatAll' },                                      // the enemy's side: becomes the player's own
      { side: 0, type: 'teleport', squads: [0] },                           // unknown
      { side: 0, type: 'move', squads: [0], x: NaN, y: 3 },                 // not a number
      { side: 0, type: 'attack', squads: [0], target: { kind: 'node', index: 0 } }, // no such target kind
      { side: 0, type: 'hold', squads: [0, 1], secret: 'x' }
    ]);
    expect(messages.find((m) => m.type === 'ordersRefused')).toMatchObject({ count: 3, full: false });
    const logged = (m) => m.type === 'checkpoint' || m.type === 'ended';
    for (let t = 16; t < 600000 && !messages.some(logged); t += 16) loop.frame(t);
    const cp = messages.find(logged);
    expect(cp.log).toEqual([
      { type: 'retreatAll', side: 0, tick: 0, seq: 0 },
      { type: 'hold', side: 0, squads: [0, 1], tick: 0, seq: 1 }
    ]);
    // the player's own retreat was applied: the attackers are leaving
    expect(loop.world.retreatOrdered?.[0]).toBe(true);
  });

  it('a deployment before Start is set down at once, and the log replays to the same world', () => {
    const messages = [];
    const loop = createBattleLoop({ setup: makeSetup(), post: (m) => messages.push(m) });
    loop.setPaused(true);
    loop.frame(0);
    const before = loop.world.squads[0].y;
    loop.pushOrders([{ side: 0, type: 'stop', squads: [1] }, { side: 0, type: 'deploy', squads: [0, 1], x: 3 * Q, y: 12 * Q, formation: 'line' }]);
    expect(loop.world.tick).toBe(0);
    expect(loop.world.squads[0].y).not.toBe(before);
    loop.setPaused(false);
    let now = 0;
    while (!messages.some((m) => m.type === 'checkpoint')) { now += 16; loop.frame(now); }
    const cp = messages.find((m) => m.type === 'checkpoint');
    expect(cp.log.map((o) => o.type)).toEqual(['stop', 'deploy']);
    expect(worldHash(replayTo(createWorld(makeSetup()), cp.log, cp.tick))).toBe(cp.hash);
    expect(runHeadless(makeSetup(), { orders: cp.log, maxTicks: cp.tick }).hash).toBe(cp.hash);
  });
});
