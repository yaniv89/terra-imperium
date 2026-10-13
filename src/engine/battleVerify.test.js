// src/engine/battleVerify.test.js
// How a commanded battle is checked before the campaign applies it (playtest audit CB01): each
// status of verifyCommandedBattle, with the build and the replay stubbed (the real ones are
// exercised end to end in tacticalBattle.test.js and src/battle/sim/replay.test.js).
import { describe, it, expect } from 'vitest';
import { verifyCommandedBattle, fieldedUnitIds, REPLAYED, VERIFY_STATUS } from './battleVerify';
import { setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';

const SETUP = {
  version: SETUP_VERSION, seed: 5, regionId: 'r', battleType: 'assault', controllers: ['player', 'ai'],
  sides: [{ canRout: false, units: [{ id: 'a1', strength: 900 }, { id: 'a2', strength: 0 }] }, { units: [{ id: 'd1', strength: 400 }] }]
};
const REPLAY_RESULT = { outcome: 'attacker', attackerUnits: [{ id: 'a1', strength: 700 }], defenderUnits: [{ id: 'd1', strength: 0 }], report: { tactical: { decisive: true } } };
const CLIENT_RESULT = { outcome: 'defender', attackerUnits: [], defenderUnits: [], report: { tactical: { verified: true, hash: 1, verification: { status: 'verified' } } } };
const ok = { build: () => SETUP, replay: () => ({ result: REPLAY_RESULT, hash: 4242, chain: 9, tick: 300, dropped: 0, truncated: false }) };
const payload = (extra = {}) => ({ battleId: 'b', result: CLIENT_RESULT, log: [{ type: 'stop', tick: 1, seq: 0 }], hash: 4242, tick: 300, setupVersion: SETUP_VERSION, setupKey: setupKeyOf(SETUP), ...extra });
const check = (p, deps = ok) => verifyCommandedBattle({}, {}, p, deps);

describe('verifyCommandedBattle', () => {
  it('verified: the replay ran the whole log and ended on the screen\'s own world', () => {
    const v = check(payload());
    expect(v.verification).toMatchObject({ status: 'verified', hash: 4242, clientHash: 4242, tick: 300, dropped: 0, setupVersion: SETUP_VERSION });
    expect(v.result.outcome).toBe('attacker'); // the replay's result, not the client's
    expect(v.result.report.tactical).toMatchObject({ verified: true, hash: 4242, decisive: true });
    expect(v.setup).toBe(SETUP);
  });

  it('an older client that sends only the log is still replayed and verified', () => {
    const v = check({ battleId: 'b', result: CLIENT_RESULT, log: [] });
    expect(v.verification).toMatchObject({ status: 'verified', clientHash: null, clientSetupVersion: null });
    expect(v.result.outcome).toBe('attacker');
  });

  it('desync, setup and cut: the replay is still the authority, never stamped verified, the evidence kept', () => {
    const desync = check(payload({ hash: 1 }));
    expect(desync.verification).toMatchObject({ status: 'desync', hash: 4242, clientHash: 1 });
    const other = check(payload({ setupKey: 'another battle' }));
    expect(other.verification.status).toBe('setup');
    const cut = check(payload(), { ...ok, replay: () => ({ ...ok.replay(), dropped: 2 }) });
    expect(cut.verification).toMatchObject({ status: 'cut', dropped: 2 });
    const long = check(payload(), { ...ok, replay: () => ({ ...ok.replay(), truncated: true }) });
    expect(long.verification).toMatchObject({ status: 'cut', truncated: true });
    [desync, other, cut, long].forEach((v) => {
      expect(REPLAYED.has(v.verification.status)).toBe(true);
      expect(v.result.outcome).toBe('attacker');
      expect(v.result.report.tactical.verified).toBe(false);
      expect(v.result.report.tactical.verification).toBe(v.verification);
    });
  });

  it('a log of another setup version is not replayed: the reported result, marked, with the evidence', () => {
    let replays = 0;
    const v = check(payload({ setupVersion: SETUP_VERSION - 1 }), { ...ok, replay: () => { replays += 1; return ok.replay(); } });
    expect(replays).toBe(0);
    expect(v.verification).toMatchObject({ status: 'version', setupVersion: SETUP_VERSION, clientSetupVersion: SETUP_VERSION - 1, clientHash: 4242, logOrders: 1 });
    expect(v.result.outcome).toBe('defender');
    // the client cannot stamp its own result verified
    expect(v.result.report.tactical.verified).toBe(false);
    expect(v.result.report.tactical.hash).toBeUndefined();
    expect(v.result.report.tactical.verification.status).toBe('version');
    expect(v.setup).toBe(SETUP); // the ledger of who took the field is still known
  });

  it('never throws: a replay or a set-up that fails falls back to the reported result', () => {
    const boom = check(payload(), { ...ok, replay: () => { throw new Error('sim blew up'); } });
    expect(boom.verification).toMatchObject({ status: 'error', error: 'sim blew up' });
    expect(boom.result.outcome).toBe('defender');
    const noBuild = check(payload(), { ...ok, build: () => { throw new Error('no grid'); } });
    expect(noBuild.verification).toMatchObject({ status: 'error', error: 'no grid' });
    expect(noBuild.setup).toBeNull();
    expect(check(payload(), { ...ok, build: () => null }).verification.status).toBe('no_setup');
    expect(check({ battleId: 'b', result: CLIENT_RESULT }).verification.status).toBe('unverified');
    expect(check({ battleId: 'b', result: null, log: 'nope' }).result.report.tactical.verified).toBe(false);
    expect(check(undefined).verification.status).toBe('unverified');
    [boom, noBuild].forEach((v) => expect(VERIFY_STATUS).toContain(v.verification.status));
  });

  it('fieldedUnitIds: the units with strength on each side', () => {
    expect(fieldedUnitIds(SETUP)).toEqual([['a1'], ['d1']]);
    expect(fieldedUnitIds(null)).toEqual([]);
  });
});
