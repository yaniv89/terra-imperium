// src/engine/battleSwitch.js
// "Switch to Auto" in the middle of a commanded battle (audit H-01): Auto goes on from the battle
// as it stands, never from the start. A commanded battle is (setup, order log): the screen sends
// the log so far and the tick it reached (battleLoop.js snapshot), and the reducer replays that log
// over THE commanded setup (buildCommandedSetup, as battleVerify.js does) to that tick. What the
// replay shows there is what Auto starts from (autoBattle.js resolveAutoBattle `spec.from`):
//   units        every regiment's strength and morale at the switch; the dead stay dead and the
//                ones that left by an exit stay out of the rest of the fight
//   reinforcements  the ones that had marched in fight on (they are in the battle)
//   walls        the walls, gate, towers and keep's remaining HP share scales the walls' HP
//   the city     what the commanded part already burned or broke is kept with Auto's own damage
//   powers       what was spent in the commanded part is spent (battleOutcome.js row 6)
// So Auto can never undo a loss: its result is at best the losses so far.
//
// Verified the same way as a commanded battle: the replay is the authority; the hash the screen
// had at the switch is compared with the replay's (status 'verified' or 'desync'; 'cut' when the
// order schema refused entries). The rest is Auto, deterministic from the battle's own seed.
// A log that cannot be replayed under these rules (another SETUP_VERSION, no setup, an error) gives
// null: the battle is settled on Auto from the start, as before. Pure.
import { buildCommandedSetup, setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { replayUntil } from '../battle/sim/replay';
import { battleLimitTicks, TICK_HZ } from '../battle/sim/constants';

// The structures that are the walls for Auto's walls rule (battleInputs.js hpRatio).
const WALL_KINDS = new Set(['keep', 'tower', 'wall', 'gate']);
const wallsHp = (structures = []) => structures
  .filter((s) => WALL_KINDS.has(s.kind) && !s.ruinedAtStart && (s.maxHp || 0) > 0)
  .reduce((a, s) => ({ hp: a.hp + (s.alive === false ? 0 : Math.max(0, Math.min(s.maxHp, s.hp ?? s.maxHp))), max: a.max + s.maxHp }), { hp: 0, max: 0 });

const finite = (v) => (Number.isFinite(v) ? v : null);

/**
 * The battle at the switch, or null when there is nothing to go on from (no log, the deployment
 * only, a log of other rules). `switchAt`: { log, tick, hash, setupKey, setupVersion } from the
 * screen. Returns { tick, atSec, units: { [id]: { side, strength, morale, disposition } },
 * joined: [attacker ids, defender ids], wallsShare, cityDamage, razed, powersUsed, verification }.
 */
export const switchedBattleState = (state, pb, switchAt, { build = buildCommandedSetup } = {}) => {
  if (!pb || !switchAt || !Array.isArray(switchAt.log) || !Number.isInteger(switchAt.tick) || switchAt.tick <= 0) return null;
  if (switchAt.setupVersion != null && switchAt.setupVersion !== SETUP_VERSION) return null;
  let setup = null;
  try { setup = build(state, pb); } catch { return null; }
  if (!setup) return null;
  let run;
  try { run = replayUntil(setup, switchAt.log, Math.min(switchAt.tick, battleLimitTicks(setup))); } catch { return null; }
  const units = {};
  [run.result.attackerUnits, run.result.defenderUnits].forEach((list, side) => list.forEach((u) => {
    units[u.id] = { side, strength: Math.max(0, u.strength), morale: Math.max(0, Math.min(100, u.morale ?? 100)), disposition: u.strength > 0 ? u.disposition : 'dead' };
  }));
  const tactical = run.result.report?.tactical || {};
  const joinedIds = new Set(tactical.joinedReinforcements || []);
  const joined = [run.result.attackerUnits, run.result.defenderUnits].map((list) => list.filter((u) => joinedIds.has(u.id)).map((u) => u.id));
  const start = wallsHp(setup.structures);
  const now = wallsHp(run.world.structures);
  const sameSetup = typeof switchAt.setupKey !== 'string' || switchAt.setupKey === setupKeyOf(setup);
  const clientHash = finite(switchAt.hash);
  const status = run.dropped || run.truncated ? 'cut' : !sameSetup ? 'setup' : clientHash != null && clientHash !== run.hash ? 'desync' : 'verified';
  return {
    tick: run.tick,
    atSec: Math.round(run.tick / TICK_HZ),
    units,
    joined,
    // Against the walls as the battle began (the setup already stood them at the siege's HP share).
    wallsShare: start.hp > 0 ? Math.min(1, now.hp / start.hp) : 1,
    cityDamage: tactical.cityDamage || null,
    razed: tactical.razed || [],
    powersUsed: tactical.powersUsed || null,
    verification: { status, setupVersion: SETUP_VERSION, clientHash, hash: run.hash, tick: run.tick, logOrders: switchAt.log.length, dropped: run.dropped || 0, truncated: !!run.truncated }
  };
};
