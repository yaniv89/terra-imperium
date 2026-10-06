// src/engine/raidBattle.js
// The one battle of a raid or a sack (plans/independent-cities.md 4.4, plans/MASTER-PLAN.md 6.1
// and 6.5, phase W2). **Phase R3 replaces `fightRaidBattle`** with the real RTS raid and sack
// battles (raid 8 to 12 minutes, sack 10 to 15, Command or Auto): everything that follows a raid
// battle (loot, pillage, the cut route, the killed settler, the burned outpost, the sack's gold,
// size and building tier, grudges, logs) reads only the RaidBattleOutcome below, so the swap
// touches this file alone.
//
// Today it is the existing auto-resolve (battle.js resolveBattle): the raid party attacks the
// defenders standing on the target tile (a sack: the city's garrison behind its walls).
//
// RaidBattleOutcome = {
//   kind:      'raid' | 'sack' | 'intercept' (a party that met an army on its way)
//   outcome:   'attacker' | 'defender' | 'stalemate'
//   raidersWon boolean (outcome === 'attacker')
//   attackers  the raid party after the battle: [{ ...unit, strength }] (strength <= 0 = dead)
//   defenders  the defenders after the battle, the same shape
//   attackerLoss, defenderLoss   strength lost by each side
//   report     resolveBattle's report (display only)
// }
// Units lost are gone: there are no captives (master plan decision 37).
// Pure and deterministic: the caller passes the rng.
import { getTiles } from '../data/geo/tiles';
import { getEffectiveAgeId } from '../data/ages';
import { resolveBattle } from './battle';
import { getTechAgeId } from './nationState';
import { legacyTerrainOf } from './world/registry';
import { getDefenseLevelDamageReductionMultiplier } from './siege';

const sum = (units) => units.reduce((s, u) => s + Math.max(0, u.strength || 0), 0);

/**
 * Fights one raid battle. `defenderId`: the defenders' nation; `tile`:
 * where it is fought; `city`: the sacked city (walls) or null.
 */
export const fightRaidBattle = (state, { kind = 'raid', defenderId, tile, city = null, attackerUnits, defenderUnits }, rng) => {
  const tiles = getTiles();
  const walls = kind === 'sack' ? (city?.defenseLevel || 0) : 0;
  if (!defenderUnits.length) {
    return { kind, outcome: 'attacker', raidersWon: true, attackers: attackerUnits, defenders: [], attackerLoss: 0, defenderLoss: 0, report: null };
  }
  const battle = resolveBattle({
    attackerUnits,
    defenderUnits,
    terrain: legacyTerrainOf(tiles, tile),
    isAttackingFortification: walls > 0,
    defenderDamageReductionMultiplier: getDefenseLevelDamageReductionMultiplier(walls),
    // Independents buy the calendar age's weapons (independents 3.4).
    attackerAgeId: state.age || 'bronze',
    defenderAgeId: getEffectiveAgeId(state.age || 'bronze', getTechAgeId(state, defenderId)),
    battleType: kind === 'sack' && walls > 0 ? 'assault' : 'field',
    rng
  });
  return {
    kind,
    outcome: battle.outcome,
    raidersWon: battle.outcome === 'attacker',
    attackers: battle.attackerUnits,
    defenders: battle.defenderUnits,
    attackerLoss: Math.round(sum(attackerUnits) - sum(battle.attackerUnits)),
    defenderLoss: Math.round(sum(defenderUnits) - sum(battle.defenderUnits)),
    report: battle.report
  };
};
