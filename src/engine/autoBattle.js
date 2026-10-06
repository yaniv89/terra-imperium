// src/engine/autoBattle.js
// The honest auto-resolve (master plan 6.1; RTS plan 10.2). A battle fought on Auto is the same
// battle as the commanded one: the same campaign inputs (battleInputs.js: the armies after the air
// turn-back and the turn's desertion, supply, starvation, plague, the city's militia, the walls'
// remaining HP) feed resolveBattle (battle.js), and the result has the same shape and goes through
// the same outcome service (battleOutcome.js).
//
// What the real-time battle has that a round-based exchange does not, modelled here:
//   walls        a siege that battered the walls (hpRatio) keeps half their effect at 0 HP
//                (battleInputs.js batteredReduction); the real-time keep starts at the same HP share
//   decisive     a field battle (6.9): the loser's units that broke are run down unless they reach
//                an exit: each routed unit escapes with AUTO_ESCAPE_CHANCE (AUTO_ESCAPE_PURSUED when
//                the winner has cavalry to pursue), else it is 'field' (still on the field: destroyed);
//                a loser still unbroken at the end withdraws by an exit ('fled'). The same rule as a
//                commanded battle's dispositions (src/battle/sim/result.js).
// Deterministic: every roll comes from the caller's rng, after resolveBattle's own. Pure.
import { resolveBattle } from './battle';
import { battleInputs, batteredReduction } from './battleInputs';

export const AUTO_ESCAPE_CHANCE = 0.6;
export const AUTO_ESCAPE_PURSUED = 0.4;

/** Dispositions for a field battle's units (6.9), from the auto-resolve's result. */
export const autoDispositions = (battle, rng) => {
  const loser = battle.outcome === 'attacker' ? 'defender' : battle.outcome === 'defender' ? 'attacker' : null;
  const winnerUnits = loser === 'attacker' ? battle.defenderUnits : loser === 'defender' ? battle.attackerUnits : [];
  const pursued = winnerUnits.some((u) => u.classId === 'cavalry' && u.strength > 0 && !u.routed);
  const mark = (list, side) => list.map((u) => {
    if (!(u.strength > 0)) return { ...u, disposition: 'dead' };
    if (side !== loser) return { ...u, disposition: u.routed ? 'fled' : 'field' };
    if (!u.routed) return { ...u, disposition: 'fled' }; // unbroken at the end: an orderly withdrawal
    return { ...u, disposition: rng.next() < (pursued ? AUTO_ESCAPE_PURSUED : AUTO_ESCAPE_CHANCE) ? 'fled' : 'field' };
  });
  return { ...battle, attackerUnits: mark(battle.attackerUnits, 'attacker'), defenderUnits: mark(battle.defenderUnits, 'defender') };
};

/**
 * Fight a battle on Auto. `args`: resolveBattle's arguments from the kind's context (invasion.js,
 * fieldBattle.js, navalBattle.js, defense.js) without the rng; `spec`: { kind, cityId,
 * fromRegionId, naval, militia } for battleInputs; `inputs` (optional) when the caller already
 * computed them. Returns resolveBattle's shape plus `inputs` (the militia among them).
 */
export const resolveAutoBattle = (state, args, spec, rng, inputs = null) => {
  const kind = spec?.kind || 'invasion';
  const naval = kind === 'naval' || !!spec?.naval;
  const ins = inputs || battleInputs(state, { attackerUnits: args.attackerUnits, defenderUnits: args.defenderUnits, cityId: naval || kind === 'field' ? null : spec?.cityId ?? null, fromRegionId: spec?.fromRegionId ?? null, naval, militia: spec?.militia ?? null });
  return autoFromInputs(args, ins, kind, rng);
};

/**
 * The auto-resolve from inputs already gathered (battleInputs.js shape: { attackerUnits,
 * defenderUnits, hpRatio, economyInputs, housing }), without a game state: the parity harness
 * (.claude/skills/battle-lab/parityEco.sim.js) feeds the same armies to this and to the sim.
 */
export const autoFromInputs = (args, ins, kind, rng) => {
  let battle = resolveBattle({
    ...args,
    attackerUnits: ins.attackerUnits,
    defenderUnits: ins.defenderUnits,
    defenderDamageReductionMultiplier: batteredReduction(args.defenderDamageReductionMultiplier ?? 1, ins.hpRatio),
    rng
  });
  if (kind === 'field') battle = autoDispositions(battle, rng);
  return { ...battle, report: { ...battle.report, mode: 'auto' }, inputs: ins };
};
