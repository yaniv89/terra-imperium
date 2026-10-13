// src/engine/battleReceipt.js
// The receipt of a commanded battle (playtest audit CB02; plan W02 tasks 1, 5): what the campaign
// commits when the battle's result is handed over. The result screen shows THIS, not its own
// reading of the live battle, so the screen, the battle report, the Log and the map agree.
//
// How: the same pure reducer that Continue runs (RESOLVE_TACTICAL_BATTLE: the verified replay,
// the sanitizer, the one outcome service) is run on the same state with the same action, and the
// receipt is read off the state it returns: the report entry of this operation with its
// participant ledger (battleLedger.js), the lines the campaign logs, the XP each regiment really
// gains, each general's real fate, the gold that really reaches the treasury, and the city as it
// then stands. Continue dispatches that same action, so what was shown is what is committed; the
// replay is not run twice (battleVerify.js keeps the last check).
// A battle that changes nothing (peace was made meanwhile, the target can no longer be fought)
// has no entry: `applied` is false and `voidLine` says why.
// Pure; no state is changed here.
import { ActionTypes } from '../data/types';
import { SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { getRankForXp } from '../data/promotions';
import { gameReducer, BATTLE_VOID_PREFIX } from './gameReducer';
import { ledgerOf } from './battleLedger';
import { syncWorldRegistry } from './world/registry';

/** The action Continue dispatches for a battle that ended (`ended`: the battle loop's end record). */
export const resolveActionOf = (pb, ended, setupKey) => ({
  type: ActionTypes.RESOLVE_TACTICAL_BATTLE,
  payload: { battleId: pb.id, result: ended.result, log: ended.log, hash: ended.hash, chain: ended.chain, tick: ended.tick, setupVersion: SETUP_VERSION, setupKey }
});

const CITY_LINE = /^The fighting left /;

/**
 * The receipt of `action` (resolveActionOf) on `state`, or null when the action is not this
 * state's pending battle. { applied, entry, ledger, line, lines, cityLine, xp, generals, goldGained,
 * city } or { applied: false, voidLine, lines }.
 */
export const battleReceipt = (state, action, { reduce = gameReducer } = {}) => {
  const pb = state?.pendingBattle;
  if (!pb || action?.payload?.battleId !== pb.id) return null;
  const next = reduce(state, action);
  // The reducer leaves the static readers (world/registry.js) on the state it returned: put them
  // back on the state the game is still in.
  syncWorldRegistry(state);
  const added = Math.max(0, (next.battleReportSeq || 0) - (state.battleReportSeq || 0));
  const fresh = (next.battleReports || []).slice(0, added);
  const ids = [pb.id, pb.defenseId].filter(Boolean);
  // Battles queued behind this one may be fought on Auto in the same step: ours is the one under
  // the operation's id.
  const entry = fresh.find((e) => ids.includes(e.opId)) || fresh.filter((e) => e.commanded).pop() || null;
  const lines = (next.logs || []).slice((state.logs || []).length).map((l) => l.message);
  if (!entry) return { applied: false, entry: null, voidLine: lines.find((m) => m.startsWith(BATTLE_VOID_PREFIX)) || null, lines };
  const ledger = ledgerOf(entry);
  const rows = (entry.sides?.[ledger.mineKey] || []).filter((u) => !u.temp);
  const xp = rows.map((u) => {
    const was = state.units?.[u.id]; const now = next.units?.[u.id];
    if (!was || !now) return null;
    const gained = (now.xp || 0) - (was.xp || 0);
    if (!(gained > 0)) return null;
    const rank = getRankForXp(now.xp || 0);
    return { id: u.id, classId: u.classId, regiment: u.regiment || null, gained, rankUp: rank !== getRankForXp(was.xp || 0) ? rank : null };
  }).filter(Boolean).sort((a, b) => b.gained - a.gained);
  const generals = rows.map((u) => {
    const cid = state.units?.[u.id]?.commanderId;
    const general = cid && state.hiredCommanders?.[cid];
    if (!general) return null;
    const after = next.hiredCommanders?.[cid];
    return { id: cid, name: general.name || 'Your general', fate: !after ? 'fell' : next.units?.[u.id] ? 'survived' : 'escaped' };
  }).filter(Boolean);
  const cityId = entry.targetRegionId && state.regions?.[entry.targetRegionId] ? entry.targetRegionId : null;
  const was = cityId ? state.regions[cityId] : null; const now = cityId ? next.regions?.[cityId] : null;
  return {
    applied: true,
    entry,
    ledger,
    line: entry.line || null,
    lines,
    cityLine: lines.find((m) => CITY_LINE.test(m)) || null,
    xp,
    generals,
    goldGained: Math.round((next.resources?.gold || 0) - (state.resources?.gold || 0)),
    city: was && now ? { id: cityId, name: now.name || was.name || cityId, taken: was.owner !== now.owner, controlBefore: was.control ?? null, control: now.control ?? null } : null
  };
};
