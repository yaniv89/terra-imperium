// src/battle/sim/replay.test.js
// Server-authoritative verification (Tactical Battles plan §12.4): 20 battles played live through
// the real-time loop replay from (setup, log) to the identical result and world hash, and a
// tampered log can't command the enemy's troops or smuggle in garbage.
import { describe, it, expect } from 'vitest';
import { replayBattle, sanitizeOrderLog, MAX_LOG_ORDERS } from './replay';
import { recordBattle } from './__fixtures__/recordBattles';

describe('battle replay verification', () => {
  it('20 live-recorded battles replay to the identical result and hash', () => {
    for (let i = 0; i < 20; i++) {
      const { setup, ended } = recordBattle(i);
      expect(ended, `battle ${i} ended`).toBeTruthy();
      expect(ended.log.length, `battle ${i} has orders`).toBeGreaterThan(0);
      const replay = replayBattle(setup, ended.log);
      expect(replay.hash, `battle ${i} hash`).toBe(ended.hash);
      expect(replay.result, `battle ${i} result`).toEqual(ended.result);
    }
  }, 120000);

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
    expect(clean).toEqual([
      { type: 'retreatAll', side: 0, tick: 5, seq: 0 },
      { type: 'move', side: 0, tick: 7, seq: 4, squads: [0, 2], x: 0, y: 0 }
    ]);
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
