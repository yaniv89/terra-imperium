// src/battle/setup/buildBattleSetup.js
// Everything a tactical battle needs, computed ONCE from the strategic game (Tactical Battles plan
// §4.2, §7.3). The sim never reads GameState: it gets this plain object (seed, map, structures,
// armies, and the exact multipliers auto-resolve would have used), which is also what makes it
// replayable anywhere — worker, test, or server.
import { REGIONS_DATA } from '../../data/regions';
import { getCombatWidth, getTerrainCombatModifier, TERRAIN_COMBAT_MODIFIERS } from '../../data/terrain';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { canSeeRegionDetails } from '../../engine/intel';
import { getRosterCombatMultiplier } from '../../data/unitClasses';
import { getDepositsFor } from '../../data/deposits';
import { getRegionModifier } from '../../engine/modifiers/sheet';
import { validateInvasion, getInvasionBattleContext, getBattlePowers, validateAmphibious, getAmphibiousBattleContext } from '../../engine/invasion';
import { getDefenseArmies, getDefenseBattleContext } from '../../engine/defense';
import { generateMap, TILE } from './mapgen';
import { BUILDING_CATEGORIES, getCategoryTierName } from '../../data/buildings';
import { polarX, polarY } from '../sim/fixed';
import { Q, SIDE_ATTACKER, secondsToTicks } from '../sim/constants';

// Bumped whenever the sim's rules change, so an old checkpoint restarts rather than replaying
// under different rules (v2: garrisons, v3: the region's buildings on the battlefield).
export const SETUP_VERSION = 3;
export const SIDE_COLORS = ['#3b82f6', '#f97316']; // colour-blind-safe blue vs orange
const TERRITORY_RADIUS = 14 * Q;

const centre = (t) => t * Q + (Q >> 1);

export const buildStructures = ({ keepTile, fortLevel, isCapital }) => {
  // An unfortified region's "keep" is just its town: it only shoots back once it has real defenses.
  const keep = {
    id: 'keep', kind: 'keep', x: centre(keepTile.x), y: centre(keepTile.y), radius: Math.round(1.5 * Q),
    maxHp: Math.round((1500 + 750 * fortLevel) * (isCapital ? 1.5 : 1)), walls: fortLevel >= 2,
    range: 8 * Q, attackTicks: secondsToTicks(1.5), damage: fortLevel > 0 ? 8 + 6 * fortLevel : 0, cooldown: 0, alive: true
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

// The province's built buildings (other than its fortifications, which are the keep and towers),
// as a list of { category, tier, name } for the battlefield.
export const getRegionBattleBuildings = (region) => Object.entries(region?.buildings?.categories || {})
  .filter(([category, tier]) => tier >= 0 && category !== 'defense' && BUILDING_CATEGORIES[category])
  .map(([category, tier]) => ({ category, tier, name: getCategoryTierName(category, tier) || BUILDING_CATEGORIES[category].label }));

// Stands each building on open ground around the keep, mostly on the defender's side of it, and
// turns its tile into a building so troops walk around it.
const placeBuildings = (map, list) => {
  if (!list.length) return [];
  const { w, h, tiles, keep } = map;
  const out = [];
  const taken = new Set();
  list.forEach((b, i) => {
    for (let tryN = 0; tryN < 48; tryN++) {
      const angle = ((i * 0.9 + tryN * 0.37) % (Math.PI * 1.6)) - Math.PI * 0.8; // east, north and south of the keep
      const r = 6 + (tryN % 4);
      const tx = Math.round(keep.x + Math.cos(angle) * r); const ty = Math.round(keep.y + Math.sin(angle) * r);
      if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
      const k = ty * w + tx;
      if (tiles[k] !== TILE.OPEN || taken.has(k)) continue;
      taken.add(k); tiles[k] = TILE.BUILDING;
      const hp = 600 + 150 * b.tier;
      out.push({ id: `b_${b.category}`, kind: 'building', category: b.category, name: b.name, tier: b.tier, x: centre(tx), y: centre(ty), radius: Math.round(0.9 * Q), maxHp: hp, hp, range: 0, attackTicks: secondsToTicks(1.5), damage: 0, cooldown: 0, alive: true });
      return;
    }
  });
  return out;
};

// Pure: works from plain inputs, so tests, the sandbox and the parity harness can build battles
// without a whole game state.
export const buildSetupFromArmies = ({
  regionId, terrain, seed, attackerUnits, defenderUnits,
  attackerAgeId = 'bronze', defenderAgeId = 'bronze', generals = {},
  fortLevel = 0, isCapital = false, infrastructure = 0, deposits = [],
  defenseReduction = 1, isAttackingFortification = fortLevel > 0, attackerPenaltyMultiplier = 1,
  attackerNationId = 'attacker', defenderNationId = 'defender',
  controllers = ['player', 'ai'], difficultyId = 'prince',
  powers = [[{ id: 'rallyCry' }], [{ id: 'rallyCry' }]], reinforcements = [[], []], intel = { attackerSeesDefender: true },
  landing = false, regionBuildings = []
}) => {
  const combatWidth = getCombatWidth(terrain);
  const map = generateMap({ regionId, terrain, combatWidth, pointCount: deposits.length, roads: 1 + (infrastructure >= 5 ? 1 : 0) + (infrastructure >= 8 ? 1 : 0), landing });
  const points = map.points.map((p, i) => ({ id: `p_${deposits[i]}`, kind: 'deposit', resId: deposits[i], x: centre(p.x), y: centre(p.y), owner: 1, progress: 0, capturingSide: -1 }));
  return {
    version: SETUP_VERSION,
    seed: seed >>> 0,
    regionId,
    terrain,
    combatWidth,
    map,
    structures: [...buildStructures({ keepTile: map.keep, fortLevel, isCapital }), ...placeBuildings(map, regionBuildings)],
    points,
    territoryRadius: TERRITORY_RADIUS,
    supplyCap: 200 + 30 * Math.max(0, infrastructure),
    startSupply: [100, 100 + (points.length ? 50 : 0)],
    sides: [
      { nationId: attackerNationId, ageId: attackerAgeId, color: SIDE_COLORS[0], units: attackerUnits.map((u) => ({ ...u })), reinforcements: reinforcements[0] || [] },
      { nationId: defenderNationId, ageId: defenderAgeId, color: SIDE_COLORS[1], units: defenderUnits.map((u) => ({ ...u })), reinforcements: reinforcements[1] || [] }
    ],
    // RoN attrition inside the defender's territory: terrain's own attrition factor, raised by
    // fortifications (towers' "patriotism").
    attritionPerMinute: 0.006 * (TERRAIN_COMBAT_MODIFIERS[terrain]?.attritionMult || 1) * (1 + 0.1 * fortLevel),
    powers,
    modifiers: {
      // The same numbers resolveBattle folds into each side's baseMultiplier, minus the walls
      // reduction — applied in the sim only to defenders actually fighting from inside their
      // territory (src/battle/sim/combat.js).
      attackerBase: attackerPenaltyMultiplier * getRosterCombatMultiplier(attackerAgeId, defenderAgeId) * getTerrainCombatModifier(terrain).attackerMult,
      defenderBase: getRosterCombatMultiplier(defenderAgeId, attackerAgeId),
      defenseReduction,
      isAttackingFortification,
      intel
    },
    generals,
    controllers,
    difficultyId
  };
};

// Which map edge a neighbouring province's troops enter from. The battlefield is laid out with
// the attacker's own origin to the WEST; every other neighbour keeps its real bearing relative to
// that (rotation only, never mirrored), then is snapped to the side's own edges.
export const reinforcementEdge = (targetRegionId, fromRegionId, neighbourRegionId, side) => {
  const t = REGION_COORDINATES[targetRegionId]; const f = REGION_COORDINATES[fromRegionId]; const n = REGION_COORDINATES[neighbourRegionId];
  if (!t || !f || !n) return side === SIDE_ATTACKER ? 'W' : 'E';
  const bearing = (c) => Math.atan2(c.lat - t.lat, (c.lng - t.lng) * Math.cos((t.lat * Math.PI) / 180)) * 180 / Math.PI;
  let m = bearing(n) + (180 - bearing(f));
  m = ((m % 360) + 540) % 360 - 180; // -180..180, 180/-180 = west, 0 = east, 90 = north
  const edge = Math.abs(m) >= 135 ? 'W' : Math.abs(m) <= 45 ? 'E' : m > 0 ? 'N' : 'S';
  if (side === SIDE_ATTACKER && edge === 'E') return m >= 0 ? 'N' : 'S';
  if (side !== SIDE_ATTACKER && edge === 'W') return m >= 0 ? 'N' : 'S';
  return edge;
};

const toReinforcements = (state, pb, sources, side) => (sources || []).map((src) => ({
  regionId: src.regionId,
  name: REGIONS_DATA[src.regionId]?.name || src.regionId,
  edge: reinforcementEdge(pb.targetRegionId, pb.fromRegionId, src.regionId, side),
  units: src.unitIds.map((id) => state.units[id]).filter(Boolean).map((u) => ({ ...u }))
})).filter((r) => r.units.length);

// The battle for a pending invasion, rebuilt purely from game state + the pending record — so a
// battle interrupted by an app restart rebuilds the identical setup and resumes.
// An AI assault on one of the player's garrisons (src/engine/defense.js): the same battlefield,
// with the player commanding the defenders and the AI's real and synthetic troops attacking.
const buildDefenseSetup = (state, pb) => {
  const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
  const region = state.regions[pb.targetRegionId];
  if (!def || !region) return null;
  const armies = getDefenseArmies(state, { ...def, attackerUnitIds: pb.attackerUnitIds, synthetic: pb.synthetic, defenderUnitIds: pb.defenderUnitIds });
  if (!armies.attackerUnits.length || !armies.defenderUnits.length) return null;
  const ctx = getDefenseBattleContext(state, def);
  const regionData = REGIONS_DATA[pb.targetRegionId] || {};
  return buildSetupFromArmies({
    regionId: pb.targetRegionId,
    terrain: ctx.terrain,
    seed: pb.seed,
    attackerUnits: armies.attackerUnits,
    defenderUnits: armies.defenderUnits,
    attackerAgeId: ctx.attackerAgeId,
    defenderAgeId: ctx.defenderAgeId,
    generals: ctx.generals,
    fortLevel: Math.max(0, Math.round(ctx.fortLevel)),
    isCapital: !!regionData.isCapital,
    infrastructure: region.currentInfrastructure || 0,
    deposits: getDepositsFor(regionData.startOwner),
    defenseReduction: ctx.defenderDamageReductionMultiplier,
    isAttackingFortification: ctx.isAttackingFortification,
    attackerNationId: pb.attackerNationId,
    defenderNationId: state.playerNationId,
    controllers: ['ai', 'player'],
    difficultyId: state.difficultyId || 'prince',
    powers: [
      getBattlePowers(state, pb.attackerNationId, ctx.attackerAgeId, armies.attackerUnits, { allowNuclear: false }),
      getBattlePowers(state, state.playerNationId, ctx.defenderAgeId, armies.defenderUnits, { allowNuclear: true })
    ],
    reinforcements: [[], toReinforcements(state, pb, pb.defenderReinforcements, 1)],
    // The AI does no espionage; the defender sees its own land regardless.
    intel: { attackerSeesDefender: false },
    regionBuildings: getRegionBattleBuildings(region)
  });
};

// A commanded amphibious landing (T9): the invaders come ashore on a beach at the west edge, with
// their fleet's guns (two Naval Bombardment salvos) covering the shore half of the field. Their
// own reinforcements can't follow by sea; the defender's neighbours can still march in.
const buildAmphibiousSetup = (state, pb) => {
  const v = validateAmphibious(state, pb.navalUnitId, pb.targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
  if (!v.ok) return null;
  const attackerUnits = v.embarkedLandUnits.filter((u) => pb.attackerUnitIds.includes(u.id));
  const defenderUnits = v.defenderLandUnits.filter((u) => pb.defenderUnitIds.includes(u.id));
  if (!attackerUnits.length || !defenderUnits.length) return null;
  const ctx = getAmphibiousBattleContext(state, { ...v, hasBeachhead: pb.hasBeachhead ?? v.hasBeachhead }, defenderUnits);
  const regionData = REGIONS_DATA[pb.targetRegionId] || {};
  const fortLevel = (v.targetRegion.defenseLevel || 0) + getRegionModifier(state, pb.targetRegionId, 'local.fortLevel').total;
  return buildSetupFromArmies({
    regionId: pb.targetRegionId,
    terrain: ctx.terrain,
    seed: pb.seed,
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
    attackerPenaltyMultiplier: ctx.attackerPenaltyMultiplier,
    attackerNationId: state.playerNationId,
    defenderNationId: v.targetRegion.owner,
    controllers: ['player', 'ai'],
    difficultyId: state.difficultyId || 'prince',
    powers: [
      [...getBattlePowers(state, state.playerNationId, ctx.attackerAgeId, attackerUnits, { allowNuclear: true }), { id: 'navalBombardment', uses: 2 }],
      getBattlePowers(state, v.targetRegion.owner, ctx.defenderAgeId, defenderUnits, { allowNuclear: false })
    ],
    reinforcements: [[], toReinforcements(state, pb, pb.defenderReinforcements, 1)],
    intel: { attackerSeesDefender: canSeeRegionDetails(state, pb.targetRegionId) },
    landing: true,
    regionBuildings: getRegionBattleBuildings(v.targetRegion)
  });
};

export const buildInvasionSetup = (state, pendingBattle) => {
  if (pendingBattle?.kind === 'defense') return buildDefenseSetup(state, pendingBattle);
  if (pendingBattle?.kind === 'amphibious') return buildAmphibiousSetup(state, pendingBattle);
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
    difficultyId: state.difficultyId || 'prince',
    powers: [
      getBattlePowers(state, state.playerNationId, ctx.attackerAgeId, attackerUnits, { allowNuclear: true }),
      getBattlePowers(state, v.targetRegion.owner, ctx.defenderAgeId, defenderUnits, { allowNuclear: false })
    ],
    reinforcements: [
      toReinforcements(state, pendingBattle, pendingBattle.attackerReinforcements, 0),
      toReinforcements(state, pendingBattle, pendingBattle.defenderReinforcements, 1)
    ],
    intel: { attackerSeesDefender: canSeeRegionDetails(state, targetRegionId) },
    regionBuildings: getRegionBattleBuildings(v.targetRegion)
  });
};

export const PLAYER_SIDE_INDEX = (pendingBattle) => (pendingBattle?.playerSide === 'defender' ? 1 : SIDE_ATTACKER);
