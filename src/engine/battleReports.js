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
// Display only: no game rule reads it back.
import { MEN_PER_STRENGTH } from './aftermath';
import { battleName } from './battleNames';

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

const sideOf = (units, beforeOf, fateOf) => (units || []).map((u) => {
  const { fate, byCavalry } = fateOf(u);
  return {
    id: u.id,
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

const menLost = (side) => side.reduce((sum, u) => sum + Math.max(0, u.before - u.after), 0) * MEN_PER_STRENGTH;
const menFled = (side) => side.reduce((sum, u) => sum + (u.routed ? u.after : 0), 0) * MEN_PER_STRENGTH;

// `report` is the full report stored as lastBattleReport (resolveBattle's report plus where and
// who). `attackers` / `defenders` are the units after the battle; `beforeOf(u)` their strength
// before it (default: the unit as it stood in `state`, i.e. before the battle was applied).
// `goneIds` (optional, a Set): units that lived but the battle's result destroyed (battleOutcome.js);
// without it a loser's unit left on the field (disposition 'field') counts as run down.
// Returns the state fields to spread into the next state.
export const recordBattleReport = (state, report, { attackers, defenders, beforeOf, goneIds = null } = {}) => {
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
  return {
    lastBattleReport: report,
    battleReports: [entry, ...(state.battleReports || [])].slice(0, BATTLE_REPORT_HISTORY),
    battleReportSeq: seq
  };
};

// Did the player win this battle? (A stalemate counts as neither.)
export const playerWon = (entry) => entry.outcome !== 'stalemate' && entry.outcome === entry.playerSide;
