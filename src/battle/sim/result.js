// src/battle/sim/result.js
// Turn a finished world into EXACTLY resolveBattle's result shape (Tactical Battles plan §10), so
// src/engine/invasion.js's applyInvasionResult consumes a commanded battle the same way it
// consumes an auto-resolved one.
import { SIDE_ATTACKER, SIDE_DEFENDER, TICK_HZ } from './constants';
import { cityDamageReport } from './cityStructures';
import { economyReport } from './economy';

// A skilled commander earns a little more XP than auto-resolve would give — capped, so battles
// can't be farmed (one attack per stack per turn already holds).
export const COMMAND_XP_BONUS_CAP = 20;
const xpBonusFor = (q) => Math.min(COMMAND_XP_BONUS_CAP, Math.floor(q.damageDealt / 150));

export const toStrategicResult = (w) => {
  // Reinforcements that were never called into the battle took no part in it: they're left out
  // entirely (the campaign keeps them exactly as they were).
  // Workers and trained auxiliaries (the battle economy) are not campaign units: they are reported
  // in `tactical.economy` (RTS plan 6.5: auxiliaries demobilise after the battle).
  const tookPart = (q) => !q.eco && (!q.reinforcement || q.joined);
  const bySide = (side) => w.squads.filter((q) => q.side === side && tookPart(q)).map((q) => ({
    ...q.original,
    strength: Math.max(0, Math.min(q.startStrength, q.strength)),
    morale: Math.max(0, Math.min(100, q.morale)),
    routed: q.routed || (q.fled && !q.retreating),
    // How it left the battle (src/engine/battleOutcome.js, master plan 6.9): a field battle's
    // loser loses the units still on the field; the ones that left by an exit step back a tile.
    disposition: !q.alive || q.strength <= 0 ? 'dead' : q.fled ? 'fled' : q.onField ? 'field' : 'reserve'
  }));
  const engagedIds = (side) => w.squads.filter((q) => q.side === side && q.engaged && !q.eco).map((q) => q.unitId);
  const attackerUnits = bySide(SIDE_ATTACKER);
  const defenderUnits = bySide(SIDE_DEFENDER);
  const deployedAttackerIds = engagedIds(SIDE_ATTACKER);
  const deployedDefenderIds = engagedIds(SIDE_DEFENDER);
  const outcome = w.ended?.outcome || 'defender';
  const log = Object.values(w.tally)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 60)
    .map((e) => ({ phase: e.phase, side: e.side === SIDE_ATTACKER ? 'attacker' : 'defender', attackerClass: e.attackerClass, defenderClass: e.defenderClass, damage: e.damage, hits: e.hits }));
  const xpBonusById = {};
  w.squads.forEach((q) => { if (q.engaged && !q.eco) xpBonusById[q.unitId] = xpBonusFor(q); });
  return {
    outcome,
    attackerUnits,
    defenderUnits,
    report: {
      combatWidth: w.setup.combatWidth,
      terrain: w.setup.terrain,
      isAttackingFortification: w.setup.modifiers.isAttackingFortification,
      deployedAttackers: deployedAttackerIds.length,
      deployedDefenders: deployedDefenderIds.length,
      reserveAttackers: attackerUnits.length - deployedAttackerIds.length,
      reserveDefenders: defenderUnits.length - deployedDefenderIds.length,
      deployedAttackerIds,
      deployedDefenderIds,
      outcome,
      log,
      tactical: {
        mode: 'command',
        durationSec: Math.round(w.tick / TICK_HZ),
        decisive: !!w.ended?.decisive,
        reason: w.ended?.reason || null,
        reservesCalled: [...w.stats.reservesCalled],
        joinedReinforcements: w.squads.filter((q) => q.reinforcement && q.joined).map((q) => q.unitId),
        powersUsed: [{ ...w.powersUsed[0] }, { ...w.powersUsed[1] }],
        xpBonusById,
        // Generals whose guard fell on the field (world.js spawnGenerals): the campaign rolls the
        // shared COMMANDER_FALL_CHANCE for each (aftermath.js); the others rode off.
        generalsStruck: w.squads.filter((q) => q.isGeneral && !q.alive).map((q) => q.isGeneral),
        generalsFielded: w.squads.filter((q) => q.isGeneral).map((q) => q.isGeneral),
        // The region's buildings the attacker burned (each loses a tier in the campaign).
        razed: [...(w.razed || [])],
        // The real city's losses by manifest id (src/engine/cityManifest.js carries them to the map).
        ...(w.setup.city ? { cityDamage: cityDamageReport(w) } : {}),
        // The battle economy's outcome per side (economy.js economyReport), for the campaign bridge (R2).
        ...(w.eco ? { economy: economyReport(w) } : {})
      }
    }
  };
};
