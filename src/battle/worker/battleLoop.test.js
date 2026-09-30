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
  });
});
