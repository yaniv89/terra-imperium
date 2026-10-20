// src/engine/battleReports.js
// The player's battle history: every battle the player fights (invasions, landings, defenses,
// naval fights, rebellions, commanded or auto-resolved) leaves a compact entry in
// state.battleReports, newest first, capped at BATTLE_REPORT_HISTORY. lastBattleReport keeps the
// full report (with its round log) for the newest battle, as before.
//
// An entry: who fought where, the outcome, each side's units before and after, the soldiers who
// fell (strength lost x MEN_PER_STRENGTH, aftermath.js), the soldiers who fled the field (routed
// survivors), and the strength-after-every-round timeline the auto-resolve replay plays back.
// Each unit also keeps its fate, how it left the battle (unitFate below), read from the rules
// that already ran (autoBattle.js autoDispositions, src/battle/sim/result.js, the adapters of
// battleOutcome.js): it records what happened and decides nothing.
// The rows are the battle's participant ledger (battleLedger.js): the totals of `fallen` and `fled`
// are its sums, so before = after + fallen + fled on each side, and the result screen, the report
// sheet and the Log read the same numbers. An entry also keeps the operation id (`opId`), the line
// the campaign logged (`line`), the troops trained for the battle (`aux`, temporary), why a
// commanded battle ended (`reason`), how it was checked (`verification`) and any ledger breach.
// Text (phase H3): an English sentence an entry stores keeps its field and has its message beside it
// as a sub() ref (messages.js: { k: 'm', key, vars }), named <field>Msg: `line` and `lineMsg`. The
// UI writes the ref in the reader's language (msgText(ref.key, ref.vars, lang)); old saves have
// only the English field. `reason` is a code (src/battle/sim/result.js), not a sentence.
// Display only: no game rule reads it back.
import { battleName } from './battleNames';
import { auxiliariesOf, menOf, sideTotals } from './battleLedger';

export const BATTLE_REPORT_HISTORY = 30;

// How a unit left the battle, in the report:
//   fellFighting  its strength reached 0
//   held          on the winning side (or a stalemate), stayed on the field
//   pulledBack    on the winning side but broken: it fell back
//   withdrew      on the losing side, unbroken: it left in good order
//   escaped       on the losing side, broken, and got away
//   runDown       on the losing side and caught: still on the field at the end (disposition
//                 'field') or removed from the map by the battle's result although it lived (no
//                 way back, trapped in a fallen city, sunk while falling back). `byCavalry` when
//                 the winner had unbroken cavalry to pursue (autoDispositions' `pursued`).
export const FATES = ['held', 'pulledBack', 'withdrew', 'escaped', 'runDown', 'fellFighting'];

/** The winner has cavalry to pursue with: the same test as autoDispositions (autoBattle.js). */
export const cavalryPursues = (winnerUnits) => (winnerUnits || []).some((u) => u.classId === 'cavalry' && u.strength > 0 && !u.routed);

/**
 * The fate of one unit (FATES). `loser`: the unit's side lost; `gone`: it lived through the
 * fighting but the battle's result destroyed it (run down, cut off, trapped, sunk).
 */
export const unitFate = (u, { loser = false, gone = false } = {}) => {
  if (!(u.strength > 0)) return 'fellFighting';
  if (!loser) return u.routed ? 'pulledBack' : 'held';
  if (gone) return 'runDown';
  return u.routed ? 'escaped' : 'withdrew';
};

// Troops that live on the battle only (never a unit on the map): the city's militia, an AI's
// expedition counted from its military strength.
const tempOf = (u) => (u.militia ? 'militia' : u.synthetic ? 'synthetic' : undefined);

const sideOf = (units, beforeOf, fateOf) => (units || []).map((u) => {
  const { fate, byCavalry } = fateOf(u);
  return {
    id: u.id,
    temp: tempOf(u),
    classId: u.classId,
    navalLine: u.navalLine || undefined,
    domain: u.domain,
    regiment: u.regiment || undefined,
    before: Math.max(0, Math.round(beforeOf(u))),
    after: Math.max(0, Math.round(u.strength || 0)),
    routed: !!u.routed && u.strength > 0,
    fate,
    byCavalry: byCavalry || undefined
  };
});

// The ledger's sums, in men: the fallen include the survivors the result destroyed (run down), the
// fled only those who got away.
const menLost = (side) => menOf(sideTotals(side).fallen);
const menFled = (side) => menOf(sideTotals(side).fled);

// `report` is the full report stored as lastBattleReport (resolveBattle's report plus where and
// who). `attackers` / `defenders` are the units after the battle; `beforeOf(u)` their strength
// before it (default: the unit as it stood in `state`, i.e. before the battle was applied).
// `goneIds` (optional, a Set): units that lived but the battle's result destroyed (battleOutcome.js);
// without it a loser's unit left on the field (disposition 'field') counts as run down.
// `breaches` (optional): what checkLedger found against the committed map (battleOutcome.js);
// given as a function of the rows, it is called with them.
// Returns the state fields to spread into the next state.
export const recordBattleReport = (state, report, { attackers, defenders, beforeOf, goneIds = null, breaches = null } = {}) => {
  const startOf = beforeOf || ((u) => state.units?.[u.id]?.strength ?? u.maxStrength ?? u.strength ?? 0);
  const seq = (state.battleReportSeq || 0) + 1;
  const loser = report.outcome === 'attacker' ? 'defender' : report.outcome === 'defender' ? 'attacker' : null;
  const pursued = loser ? cavalryPursues(loser === 'attacker' ? defenders : attackers) : false;
  const fateFor = (side) => (u) => {
    const fate = unitFate(u, { loser: side === loser, gone: goneIds ? goneIds.has(u.id) : u.disposition === 'field' });
    return { fate, byCavalry: fate === 'runDown' && pursued };
  };
  const attacker = sideOf(attackers, startOf, fateFor('attacker'));
  const defender = sideOf(defenders, startOf, fateFor('defender'));
  const playerSide = report.attackerNationId === state.playerNationId ? 'attacker' : 'defender';
  const entry = {
    id: `battle-${seq}`,
    turn: state.turnNumber,
    year: state.year,
    kind: report.kind || 'land',
    // "Siege of Kish", "Battle of Sippar" (battleNames.js), fixed when the battle is fought; the
    // outcome service (battleOutcome.js) passes the name it gave the battle.
    name: report.name || battleName(state, { kind: report.kind || 'land', targetRegionId: report.targetRegionId ?? null, tile: report.tile ?? null }),
    tile: report.tile ?? null,
    defense: !!report.defense,
    commanded: !!report.tactical || report.mode === 'command',
    fromRegionId: report.fromRegionId ?? null,
    targetRegionId: report.targetRegionId ?? null,
    attackerNationId: report.attackerNationId ?? null,
    defenderNationId: report.defenderNationId ?? null,
    playerSide,
    outcome: report.outcome,
    captured: !!report.captured,
    rounds: report.rounds ?? null,
    terrain: report.terrain ?? null,
    battleType: report.battleType ?? null,
    timeline: report.timeline || null,
    sides: { attacker, defender },
    fallen: { attacker: menLost(attacker), defender: menLost(defender) },
    fled: { attacker: menFled(attacker), defender: menFled(defender) }
  };
  const tactical = report.tactical || null;
  const aux = auxiliariesOf(report);
  const found = typeof breaches === 'function' ? breaches({ attacker, defender }) : breaches;
  if (report.opId) entry.opId = report.opId;
  if (report.line) entry.line = report.line;
  if (report.line && report.lineMsg) entry.lineMsg = report.lineMsg;
  if (aux) entry.aux = aux;
  if (tactical?.reason) entry.reason = tactical.reason;
  if (tactical?.durationSec) entry.durationSec = tactical.durationSec;
  // Commanded, then switched to Auto (battleSwitch.js): the second of the battle the switch came at.
  if (tactical?.mode === 'switched') entry.switchedAtSec = tactical.switchedAtSec ?? 0;
  if (tactical?.verification?.status) entry.verification = tactical.verification.status;
  if (found?.length) entry.breaches = found.slice(0, 12);
  return {
    lastBattleReport: report,
    battleReports: [entry, ...(state.battleReports || [])].slice(0, BATTLE_REPORT_HISTORY),
    battleReportSeq: seq
  };
};

// Did the player win this battle? (A stalemate counts as neither.)
export const playerWon = (entry) => entry.outcome !== 'stalemate' && entry.outcome === entry.playerSide;
