// src/engine/battleVerify.js
// The verification of a commanded battle (playtest audit CB01; plan W01; addendum X03, X04).
// RESOLVE_TACTICAL_BATTLE never trusts the result the battle screen reports: it rebuilds THE
// commanded setup (buildCommandedSetup: the same function the screen was given its setup by) and
// replays the player's order log over it (src/battle/sim/replay.js). The replay's result is the
// one the campaign applies, and it equals what the player saw, because the live battle and the
// replay admit orders through one schema (src/battle/sim/orderSchema.js).
//
// What is checked, and what happens (the `status` kept on the battle report as
// `tactical.verification`, with the evidence: versions, hashes, ticks, order counts):
//   verified    the replay ran the whole log and, when the screen sent its final world hash, landed
//               on that same hash. The replay's result is applied.
//   desync      the replay ran but ended on another hash than the screen's. The replay's result is
//               applied (it is the authority); both hashes are kept.
//   setup       the screen fought a setup with another identity (setupKeyOf) than the one rebuilt
//               here. As desync.
//   cut         entries of the log were refused or the log was over its cap. The replay of the rest
//               is applied, never stamped verified.
//   version     the log was recorded under another SETUP_VERSION (an older or newer build): it is
//               not replayed under these rules. The reported result is used, sanitized.
//   error       building the setup or replaying threw. The reported result is used, sanitized.
//   no_setup    the battle can no longer be set up. The reported result is used, sanitized.
//   unverified  no log came with the result (older clients, tests). The reported result is used.
// "Sanitized" is gameReducer.js sanitizeTacticalResult: only the locked units, strength only down.
// Nothing here throws: a battle always ends in the outcome service.
import { buildCommandedSetup, setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { replayBattle } from '../battle/sim/replay';

export const VERIFY_STATUS = ['verified', 'desync', 'setup', 'cut', 'version', 'error', 'no_setup', 'unverified'];
/** The statuses under which the campaign applies the replay's own result. */
export const REPLAYED = new Set(['verified', 'desync', 'setup', 'cut']);

const finite = (v) => (Number.isFinite(v) ? v : null);
const stamp = (result, verification, hash = null) => {
  const base = result && typeof result === 'object' ? result : {};
  const tactical = { ...(base.report?.tactical || {}), verified: verification.status === 'verified', verification };
  if (hash != null) tactical.hash = hash; else delete tactical.hash;
  return { ...base, report: { ...(base.report || {}), tactical } };
};

/**
 * The units that took the field in `setup`, by side: [attacker ids, defender ids]. Every one of
 * them is a squad of the battle (src/battle/sim/world.js spawnSides: front line or reserve), so
 * every one of them is in the battle's result (sim/result.js). Reinforcements standing by are not
 * here: they count only when the battle says they marched in.
 */
export const fieldedUnitIds = (setup) => (setup?.sides || []).slice(0, 2).map((s) => (s?.units || []).filter((u) => u && u.strength > 0).map((u) => u.id));

/**
 * `payload` is RESOLVE_TACTICAL_BATTLE's: { result, log, hash, chain, tick, setupVersion, setupKey }
 * (the last five are the live battle's own end record; older clients send only result and log).
 * Returns { result, setup, verification }: the result to sanitize and apply, with
 * `report.tactical.verified` and `.verification` set here (never taken from the client).
 */
// The last check, kept by identity: the result screen asks for the committed outcome when the
// battle ends and Continue commits it with the same state and the same payload (battleReceipt.js),
// so the battle is replayed once, not twice. A pure function's memo: same inputs, same answer.
let last = null;

export const verifyCommandedBattle = (state, pb, payload = {}, { build = buildCommandedSetup, replay = replayBattle } = {}) => {
  if (last&& last.state === state && last.pb === pb && last.payload === payload && last.build === build && last.replay === replay) return last.out;
  const out = verifyOnce(state, pb, payload, { build, replay });
  last = { state, pb, payload, build, replay, out };
  return out;
};

const verifyOnce = (state, pb, payload, { build, replay }) => {
  const log = payload.log;
  const evidence = {
    setupVersion: SETUP_VERSION,
    clientSetupVersion: finite(payload.setupVersion),
    clientHash: finite(payload.hash),
    clientTick: finite(payload.tick),
    logOrders: Array.isArray(log) ? log.length : null
  };
  let setup = null;
  const reported = (status, extra = {}) => {
    const verification = { status, ...evidence, ...extra };
    return { result: stamp(payload.result, verification), setup, verification };
  };
  try { setup = build(state, pb); } catch (err) { return reported('error', { error: String(err?.message || err).slice(0, 200) }); }
  if (!Array.isArray(log)) return reported('unverified');
  if (!setup) return reported('no_setup');
  if (evidence.clientSetupVersion != null && evidence.clientSetupVersion !== SETUP_VERSION) return reported('version');
  let run;
  try { run = replay(setup, log); } catch (err) { return reported('error', { error: String(err?.message || err).slice(0, 200) }); }
  const sameSetup = typeof payload.setupKey !== 'string' || payload.setupKey === setupKeyOf(setup);
  const status = run.dropped || run.truncated ? 'cut'
    : !sameSetup ? 'setup'
      : evidence.clientHash != null && evidence.clientHash !== run.hash ? 'desync'
        : 'verified';
  const verification = { status, ...evidence, hash: run.hash, tick: run.tick, dropped: run.dropped || 0, truncated: !!run.truncated };
  return { result: stamp(run.result, verification, run.hash), setup, verification };
};
