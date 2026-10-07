// The frozen empty battle (phone playtest): "the screen froze with 0 units and no buttons; I saw a
// naked map with only the enemy's houses". The guards: a battle with nobody on a side never opens
// (settled on Auto with a log line), a set-up error is reported, and a checkpoint left by another
// game's battle under the same id is never resumed into this one.
import { describe, it, expect, vi } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNeighborIds } from '../../data/regions';
import { atGates } from '../../engine/testWorld';
import { buildInvasionSetup, setupKeyOf, setupHasBothSides, SETUP_VERSION } from '../../battle/setup/buildBattleSetup';
import { createBattleLoop } from '../../battle/worker/battleLoop';
import { battleOpenProblem, checkpointFits, safeBattleSetup } from './battleOpenGuard';

const game = () => {
  const s = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  return { ...s, resources: { ...s.resources, gold: 5000 } };
};
const KISH = game().nations.akkad.capitalRegionId;
const [CITY_A, CITY_B] = getNeighborIds(KISH);
// A commanded assault on `city` with the army at its gates, as the army sheet starts it.
const assault = (city) => gameReducer(atGates(game(), KISH, city), { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: KISH, targetRegionId: city } });
// A checkpoint of a battle that was played for a while (as the screen saves every 10 s).
const checkpointOf = (setup) => {
  let cp = null;
  const loop = createBattleLoop({ setup, post: (m) => { if (m.type === 'checkpoint') cp = m; } });
  loop.pushOrders([{ side: 0, type: 'attackMove', squads: [0], x: 60 * 256, y: 30 * 256 }]);
  for (let t = 0; !cp && t < 60000; t += 50) loop.frame(t);
  return { ...cp, setupVersion: SETUP_VERSION, setupKey: setupKeyOf(setup) };
};

describe('opening a commanded battle', () => {
  it('a normal assault opens: both sides have troops, no problem', () => {
    const s = assault(CITY_A);
    const built = safeBattleSetup(s, s.pendingBattle);
    expect(built.setup).toBeTruthy();
    expect(setupHasBothSides(built.setup)).toBe(true);
    expect(battleOpenProblem(built)).toBe(null);
  });

  it('battle ids repeat between games, so a checkpoint must match the battle it resumes', () => {
    const a = assault(CITY_A); const b = assault(CITY_B);
    expect(a.pendingBattle.id).toBe(b.pendingBattle.id); // b_1_1 in both games: the old bug's key
    const setupA = buildInvasionSetup(a, a.pendingBattle); const setupB = buildInvasionSetup(b, b.pendingBattle);
    const cpA = checkpointOf(setupA);
    expect(checkpointFits(cpA, setupA)).toBe(true);
    expect(checkpointFits(cpA, setupB)).toBe(false);
    // Older checkpoints carry no key: never trusted.
    expect(checkpointFits({ ...cpA, setupKey: undefined }, setupA)).toBe(false);
    // Even past the key, the loop itself refuses a replay that does not land on the saved hash.
    const posts = [];
    const loop = createBattleLoop({ setup: setupB, resume: cpA, post: (m) => posts.push(m.type) });
    expect(posts).toContain('resumeRejected');
    expect(loop.world.tick).toBe(0);
  });

  it('a battle with no troops on a side never opens: it is settled on Auto with a log line', () => {
    const s = assault(CITY_A);
    const setup = buildInvasionSetup(s, s.pendingBattle);
    const noAttackers = { ...setup, sides: [{ ...setup.sides[0], units: [] }, setup.sides[1]] };
    const noDefenders = { ...setup, sides: [setup.sides[0], { ...setup.sides[1], units: setup.sides[1].units.map((u) => ({ ...u, strength: 0 })) }] };
    expect(battleOpenProblem({ setup: noAttackers })).toBe('no_attackers');
    expect(battleOpenProblem({ setup: noDefenders })).toBe('no_defenders');
    expect(battleOpenProblem({ setup: null })).toBe('no_setup');
    // The attacker is gone (moved away) by the time the screen opens: no setup, no frozen field.
    const gone = { ...s, units: Object.fromEntries(Object.entries(s.units).filter(([id]) => !s.pendingBattle.attackerUnitIds.includes(id))) };
    expect(buildInvasionSetup(gone, s.pendingBattle)).toBe(null);
    // Settled through the outcome service with the reason in the log.
    const settled = gameReducer(s, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { reason: 'no_defenders' } });
    expect(settled.pendingBattle).toBe(null);
    expect(settled.logs[settled.logs.length - 1].message).toMatch(/was settled on Auto: no defenders were left to fight/);
    const plain = gameReducer(s, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(settled.regions[CITY_A].owner).toBe(plain.regions[CITY_A].owner); // the same Auto result
    expect(JSON.stringify(settled.units)).toBe(JSON.stringify(plain.units));
  });

  it('an exception while setting the battle up is reported, not thrown', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = assault(CITY_A);
    const built = safeBattleSetup(s, s.pendingBattle, () => { throw new Error('mapgen failed'); });
    expect(built).toEqual({ setup: null, error: 'mapgen failed' });
    expect(battleOpenProblem(built)).toBe(null); // shown to the player, who picks Auto or Try again
    spy.mockRestore();
  });
});
