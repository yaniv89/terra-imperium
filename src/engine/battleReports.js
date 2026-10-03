// src/engine/battleReports.js
// The player's battle history: every battle the player fights (invasions, landings, defenses,
// naval fights, rebellions, commanded or auto-resolved) leaves a compact entry in
// state.battleReports, newest first, capped at BATTLE_REPORT_HISTORY. lastBattleReport keeps the
// full report (with its round log) for the newest battle, as before.
//
// An entry: who fought where, the outcome, each side's units before and after, the soldiers who
// fell (strength lost x MEN_PER_STRENGTH, aftermath.js), the soldiers who fled the field (routed
// survivors), and the strength-after-every-round timeline the auto-resolve replay plays back.
// Display only: no game rule reads it back.
import { MEN_PER_STRENGTH } from './aftermath';

export const BATTLE_REPORT_HISTORY = 30;

const sideOf = (units, beforeOf) => (units || []).map((u) => ({
  id: u.id,
  classId: u.classId,
  domain: u.domain,
  before: Math.max(0, Math.round(beforeOf(u))),
  after: Math.max(0, Math.round(u.strength || 0)),
  routed: !!u.routed && u.strength > 0
}));

const menLost = (side) => side.reduce((sum, u) => sum + Math.max(0, u.before - u.after), 0) * MEN_PER_STRENGTH;
const menFled = (side) => side.reduce((sum, u) => sum + (u.routed ? u.after : 0), 0) * MEN_PER_STRENGTH;

// `report` is the full report stored as lastBattleReport (resolveBattle's report plus where and
// who). `attackers` / `defenders` are the units after the battle; `beforeOf(u)` their strength
// before it (default: the unit as it stood in `state`, i.e. before the battle was applied).
// Returns the state fields to spread into the next state.
export const recordBattleReport = (state, report, { attackers, defenders, beforeOf } = {}) => {
  const startOf = beforeOf || ((u) => state.units?.[u.id]?.strength ?? u.maxStrength ?? u.strength ?? 0);
  const seq = (state.battleReportSeq || 0) + 1;
  const attacker = sideOf(attackers, startOf);
  const defender = sideOf(defenders, startOf);
  const playerSide = report.attackerNationId === state.playerNationId ? 'attacker' : 'defender';
  const entry = {
    id: `battle-${seq}`,
    turn: state.turnNumber,
    year: state.year,
    kind: report.kind || 'land',
    defense: !!report.defense,
    commanded: !!report.tactical,
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
