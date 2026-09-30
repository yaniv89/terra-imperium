// src/battle/setup/buildBattleSetup.js
// Everything a tactical battle needs, computed ONCE from the strategic game (Tactical Battles plan
// §4.2, §7.3). The sim never reads GameState: it gets this plain object (seed, map, structures,
// armies, and the exact multipliers auto-resolve would have used), which is also what makes it
// replayable anywhere — worker, test, or server.
import { REGIONS_DATA } from '../../data/regions';
import { getCombatWidth, getTerrainCombatModifier } from '../../data/terrain';
import { getRosterCombatMultiplier } from '../../data/unitClasses';
import { getDepositsFor } from '../../data/deposits';
import { getRegionModifier } from '../../engine/modifiers/sheet';
import { validateInvasion, getInvasionBattleContext } from '../../engine/invasion';
import { generateMap } from './mapgen';
import { polarX, polarY } from '../sim/fixed';
import { Q, SIDE_ATTACKER, secondsToTicks } from '../sim/constants';

export const SETUP_VERSION = 1;
export const SIDE_COLORS = ['#3b82f6', '#f97316']; // colour-blind-safe blue vs orange
const TERRITORY_RADIUS = 14 * Q;

const centre = (t) => t * Q + (Q >> 1);

export const buildStructures = ({ keepTile, fortLevel, isCapital }) => {
  const keep = {
    id: 'keep', kind: 'keep', x: centre(keepTile.x), y: centre(keepTile.y), radius: Math.round(1.5 * Q),
    maxHp: Math.round((1500 + 750 * fortLevel) * (isCapital ? 1.5 : 1)), walls: fortLevel >= 2,
    range: 8 * Q, attackTicks: secondsToTicks(1.5), damage: 14 + 6 * fortLevel, cooldown: 0, alive: true
  };
  keep.hp = keep.maxHp;
  const towerCount = Math.min(6, Math.floor(fortLevel / 2) + (isCapital ? Math.max(0, 2 - Math.floor(fortLevel / 2)) : 0));
  const towers = Array.from({ length: towerCount }, (_, i) => {
    // Spread across the keep's west-facing arc (the side the attacker comes from).
    const angle = (128 + Math.round((i - (towerCount - 1) / 2) * 26)) & 255;
    const hp = 800 + 200 * fortLevel;
    return {
      id: `tower${i}`, kind: 'tower', x: keep.x + polarX(angle, 6 * Q), y: keep.y + polarY(angle, 6 * Q), radius: Math.round(0.8 * Q),
      maxHp: hp, hp, range: 7 * Q, attackTicks: secondsToTicks(1.5), damage: 8 + 4 * fortLevel, cooldown: 0, alive: true
    };
  });
  return [keep, ...towers];
};

// Pure: works from plain inputs, so tests, the sandbox and the parity harness can build battles
// without a whole game state.
export const buildSetupFromArmies = ({
  regionId, terrain, seed, attackerUnits, defenderUnits,
  attackerAgeId = 'bronze', defenderAgeId = 'bronze', generals = {},
  fortLevel = 0, isCapital = false, infrastructure = 0, deposits = [],
  defenseReduction = 1, isAttackingFortification = fortLevel > 0, attackerPenaltyMultiplier = 1,
  attackerNationId = 'attacker', defenderNationId = 'defender',
  controllers = ['player', 'ai'], difficultyId = 'prince'
}) => {
  const combatWidth = getCombatWidth(terrain);
  const map = generateMap({ regionId, terrain, combatWidth, pointCount: deposits.length, roads: 1 + (infrastructure >= 5 ? 1 : 0) + (infrastructure >= 8 ? 1 : 0) });
  const points = map.points.map((p, i) => ({ id: `p_${deposits[i]}`, kind: 'deposit', resId: deposits[i], x: centre(p.x), y: centre(p.y), owner: 1, progress: 0, capturingSide: -1 }));
  return {
    version: SETUP_VERSION,
    seed: seed >>> 0,
    regionId,
    terrain,
    combatWidth,
    map,
    structures: buildStructures({ keepTile: map.keep, fortLevel, isCapital }),
    points,
    territoryRadius: TERRITORY_RADIUS,
    supplyCap: 200 + 30 * Math.max(0, infrastructure),
    startSupply: [100, 100 + (points.length ? 50 : 0)],
    sides: [
      { nationId: attackerNationId, ageId: attackerAgeId, color: SIDE_COLORS[0], units: attackerUnits.map((u) => ({ ...u })) },
      { nationId: defenderNationId, ageId: defenderAgeId, color: SIDE_COLORS[1], units: defenderUnits.map((u) => ({ ...u })) }
    ],
    modifiers: {
      // The same numbers resolveBattle folds into each side's baseMultiplier, minus the walls
      // reduction — applied in the sim only to defenders actually fighting from inside their
      // territory (src/battle/sim/combat.js).
      attackerBase: attackerPenaltyMultiplier * getRosterCombatMultiplier(attackerAgeId, defenderAgeId) * getTerrainCombatModifier(terrain).attackerMult,
      defenderBase: getRosterCombatMultiplier(defenderAgeId, attackerAgeId),
      defenseReduction,
      isAttackingFortification
    },
    generals,
    controllers,
    difficultyId
  };
};

// The battle for a pending invasion, rebuilt purely from game state + the pending record — so a
// battle interrupted by an app restart rebuilds the identical setup and resumes.
export const buildInvasionSetup = (state, pendingBattle) => {
  const { fromRegionId, targetRegionId, seed, playerSide = 'attacker' } = pendingBattle;
  const v = validateInvasion(state, fromRegionId, targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
  if (!v.ok) return null;
  const attackerIds = new Set(pendingBattle.attackerUnitIds || v.attackerUnits.map((u) => u.id));
  const defenderIds = new Set(pendingBattle.defenderUnitIds || v.defenderUnits.map((u) => u.id));
  const attackerUnits = v.attackerUnits.filter((u) => attackerIds.has(u.id));
  const defenderUnits = v.defenderUnits.filter((u) => defenderIds.has(u.id));
  const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits });
  const regionData = REGIONS_DATA[targetRegionId] || {};
  const fortLevel = (v.targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total;
  return buildSetupFromArmies({
    regionId: targetRegionId,
    terrain: ctx.terrain,
    seed,
    attackerUnits,
    defenderUnits,
    attackerAgeId: ctx.attackerAgeId,
    defenderAgeId: ctx.defenderAgeId,
    generals: ctx.generals || {},
    fortLevel: Math.max(0, Math.round(fortLevel)),
    isCapital: !!regionData.isCapital,
    infrastructure: v.targetRegion.currentInfrastructure || 0,
    deposits: getDepositsFor(regionData.startOwner),
    defenseReduction: ctx.defenderDamageReductionMultiplier,
    isAttackingFortification: ctx.isAttackingFortification,
    attackerNationId: state.playerNationId,
    defenderNationId: v.targetRegion.owner,
    controllers: playerSide === 'attacker' ? ['player', 'ai'] : ['ai', 'player'],
    difficultyId: state.difficultyId || 'prince'
  });
};

export const PLAYER_SIDE_INDEX = (pendingBattle) => (pendingBattle?.playerSide === 'defender' ? 1 : SIDE_ATTACKER);
