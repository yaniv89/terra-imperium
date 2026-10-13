// src/battle/sim/replay.test.js
// Server-authoritative verification (Tactical Battles plan §12.4): 20 battles played live through
// the real-time loop replay from (setup, log) to the identical result and world hash, and a
// tampered log can't command the enemy's troops or smuggle in garbage.
import { describe, it, expect } from 'vitest';
import { replayBattle, sanitizeOrderLog, auditOrderLog, MAX_LOG_ORDERS } from './replay';
import { recordBattle, recordCommandedBattle } from './__fixtures__/recordBattles';
import { createWorld } from './world';
import { step } from './step';
import { worldHash } from './hash';

describe('battle replay verification', () => {
  it('20 live-recorded battles replay to the identical result and hash', () => {
    for (let i = 0; i < 20; i++) {
      const { setup, ended } = recordBattle(i);
      expect(ended, `battle ${i} ended`).toBeTruthy();
      expect(ended.log.length, `battle ${i} has orders`).toBeGreaterThan(0);
      const replay = replayBattle(setup, ended.log);
      expect(replay.hash, `battle ${i} hash`).toBe(ended.hash);
      expect(replay.chain, `battle ${i} hash chain`).toBe(ended.chain);
      expect(replay.result, `battle ${i} result`).toEqual(ended.result);
    }
  }, 120000);

  // Playtest audit CB01 (I001 "Victory becomes campaign defeat", addendum X03 and X06): the battle
  // the campaign really fights. The economy on, the commanded setup, a deployment before Start and
  // every order the screen sends. Its replay used to drop the deployment and every economy order
  // and to run on the bare setup, where the player's squads rout: another battle.
  it('a commanded economy battle (deploy, build, train, gather, repair, rally, cancels) replays to the identical world', () => {
    const { setup, bare, ended, used, refused } = recordCommandedBattle(0);
    expect(ended, 'the battle ended').toBeTruthy();
    expect(refused, 'no order of the script was refused live').toBe(0);
    expect(used).toEqual(expect.arrayContaining(['deploy', 'gather', 'build', 'assist', 'repair', 'train', 'cancelTrain', 'rally', 'cancelBuild', 'attack', 'attackMove', 'move', 'power', 'callReserve']));
    // the orders did something: a barracks went up and soldiers were trained in it
    const eco = ended.result.report.tactical.economy[0];
    expect(eco.buildingsBuilt).toBeGreaterThan(0);
    expect(eco.trained.infantry).toBeGreaterThan(0);
    // the log is clean as recorded, and the replay is the same battle, tick for tick
    const side = setup.controllers.indexOf('player');
    expect(auditOrderLog(ended.log, side)).toMatchObject({ dropped: 0, truncated: false });
    expect(sanitizeOrderLog(ended.log, side)).toEqual(ended.log);
    const replay = replayBattle(setup, ended.log);
    expect(replay.hash).toBe(ended.hash);
    expect(replay.chain).toBe(ended.chain);
    expect(replay.tick).toBe(ended.tick);
    expect(replay.result).toEqual(ended.result);
    expect(replay).toMatchObject({ dropped: 0, truncated: false });
    // The player's squads never routed (the commanded rule)...
    expect(ended.result.attackerUnits.some((u) => u.routed)).toBe(false);
    // ...and the same log over the bare setup is NOT this battle: there they break and run.
    const without = replayBattle(bare, ended.log);
    expect(without.hash).not.toBe(ended.hash);
    expect(without.result.attackerUnits.some((u) => u.routed)).toBe(true);
    // Every unit that took the field is in the result (the ledger invariant, addendum X04).
    [0, 1].forEach((s) => expect(ended.result[s ? 'defenderUnits' : 'attackerUnits'].map((u) => u.id).sort()).toEqual(setup.sides[s].units.map((u) => u.id).sort()));
  }, 600000);

  it('the same holds with the player defending, and the deployment is set down before the first tick', () => {
    const { setup, ended, used } = recordCommandedBattle(1);
    expect(used).toEqual(expect.arrayContaining(['deploy', 'gather', 'build']));
    const replay = replayBattle(setup, ended.log);
    expect(replay.hash).toBe(ended.hash);
    expect(replay.chain).toBe(ended.chain);
    expect(replay.result).toEqual(ended.result);
    // The log opens with an economy order and then the deployment, both before Start. Run in the
    // log's plain order (the deployment through the first tick, after the gather order, the fog and
    // the AI's first thought) it is another battle: the replay must set it down first, as live.
    expect(ended.log.slice(0, 3).map((o) => [o.type, o.tick])).toEqual([['gather', 0], ['deploy', 0], ['deploy', 0]]);
    const world = createWorld(setup);
    const byTick = new Map();
    ended.log.forEach((o) => { const l = byTick.get(o.tick) || []; l.push(o); byTick.set(o.tick, l); });
    while (!world.ended && world.tick < ended.tick + 5) { step(world, byTick.get(world.tick) || []); world.events.length = 0; }
    expect(worldHash(world)).not.toBe(ended.hash);
  }, 600000);

  it('forces every order onto the player\'s side and drops junk', () => {
    const log = [
      { side: 1, type: 'retreatAll', tick: 5, seq: 0 },
      { side: 0, type: 'teleport', tick: 6, seq: 1 },
      { side: 0, type: 'move', tick: -1, seq: 2, squads: [0], x: 1, y: 1 },
      { side: 0, type: 'move', tick: 3.5, seq: 3, squads: [0], x: 1, y: 1 },
      { side: 0, type: 'move', tick: 7, seq: 4, squads: [0, -1, 'x', 2], x: NaN, y: Infinity, evil: true },
      null, 'hello'
    ];
    const clean = sanitizeOrderLog(log, 0);
    // (An order with a coordinate that is no number is refused whole: it used to become a march to 0,0.)
    expect(clean).toEqual([{ type: 'retreatAll', side: 0, tick: 5, seq: 0 }]);
    expect(sanitizeOrderLog([{ side: 1, type: 'move', tick: 7, seq: 4, squads: [0, -1, 'x', 2], x: 3, y: 4.5, evil: true }], 0)).toEqual([{ type: 'move', side: 0, tick: 7, seq: 4, squads: [0, 2], x: 3, y: 4.5 }]);
    // The audit says what the cleaning left out, so a cut log is never called a clean verification.
    expect(auditOrderLog(log, 0)).toMatchObject({ dropped: 6, truncated: false });
    expect(auditOrderLog(Array.from({ length: MAX_LOG_ORDERS + 1 }, () => ({ type: 'stop', tick: 1, seq: 0 })), 0)).toMatchObject({ dropped: 0, truncated: true });
    expect(sanitizeOrderLog(Array.from({ length: MAX_LOG_ORDERS + 50 }, (_, i) => ({ type: 'stop', tick: i % 100, seq: i })), 1)).toHaveLength(MAX_LOG_ORDERS);
    expect(sanitizeOrderLog('nope', 0)).toEqual([]);
  });

  it('an injected enemy-side retreat changes nothing: the replay ignores who the client says gave it', () => {
    const { setup, ended } = recordBattle(3);
    const enemy = 1 - setup.controllers.indexOf('player');
    const forged = [...ended.log, { side: enemy, type: 'retreatAll', tick: 1, seq: 99999 }];
    const replay = replayBattle(setup, forged);
    // the forged order became the PLAYER's own retreat, so it can only hurt the cheater
    if (setup.controllers[0] === 'player') expect(replay.result.outcome).not.toBe('attacker');
  }, 30000);
});
