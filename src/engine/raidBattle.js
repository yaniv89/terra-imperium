// src/engine/raidBattle.js
// The battle of a raid or a sack (plans/independent-cities.md 4.4, plans/MASTER-PLAN.md 6.1, 6.5,
// 6.8; phase R3). A raid is the one light battle (no base-building): the raiders come for loot, burn
// it and run; the defender wins by killing or driving them off first. Two ways to fight it, the
// same battle:
//   Command  the real-time battle (src/battle/setup/battleType.js 'raid' and 'sack': loot targets on
//            the field, burn RAID_LOOT_NEEDED and get away by the raiders' edge; a sack burns the
//            real town's buildings and houses)
//   Auto     the honest auto-resolve (autoBattle.js, kinds 'raid' and 'sack', measured against the
//            real-time battle with the battle-lab parityEco harness)
// Both end in the one outcome service (battleOutcome.js, raidAdapter): beaten raiders still on the
// field are cut down, the ones that got away live; the defenders keep their survivors; XP,
// devastation, war exhaustion, the battle's mark, the report. A sack the raiders won burns the town
// under the 50% rule (sackCityDamage: the houses and the building they burned, at least the best
// building and a size's worth of houses; cityManifest.js carries at most half to the map).
// Everything that follows a raid battle on the campaign map (loot, pillage, the cut route, the
// killed settler, the burned outpost, the sack's gold, grudges, the march home) is raids.js
// (settleRaidBattle). Battles against the player wait in the battle queue (battleQueue.js) for
// Command or Auto; the others are fought on Auto at once.
// Units lost are gone: there are no captives (master plan decision 37). Pure.
import { getTiles } from '../data/geo/tiles';
import { getEffectiveAgeId } from '../data/ages';
import { getTechAgeId } from './nationState';
import { legacyTerrainOf } from './world/registry';
import { getDefenseLevelDamageReductionMultiplier } from './siege';
import { resolveAutoBattle } from './autoBattle';
import { makeBattleOutcome, battleIdOf } from './battleOutcome';
import { cityManifestOf, cityDamageOf } from './cityManifest';
import { cityMilitia } from './battleInputs';

export const RAID_BATTLE_KINDS = ['raid', 'sack'];
export const isRaidKind = (kind) => RAID_BATTLE_KINDS.includes(kind);

const sum = (units) => units.reduce((s, u) => s + Math.max(0, u.strength || 0), 0);

/** The city a raid battle is about: the sacked city, else null. */
const sackedCityOf = (state, b) => (b.kind === 'sack' ? state.regions[b.cityId ?? b.city?.id] || b.city || null : null);

/**
 * resolveBattle's arguments for a raid battle, without the armies. `b`: { kind ('raid' | 'sack'),
 * attackerId, defenderId, tile, cityId }. Independents buy the calendar age's weapons (independents 3.4).
 */
export const raidBattleContext = (state, b) => {
  const tiles = getTiles();
  const city = sackedCityOf(state, b);
  const walls = city?.defenseLevel || 0;
  const ageOf = (id) => getEffectiveAgeId(state.age || 'bronze', getTechAgeId(state, id));
  return {
    terrain: legacyTerrainOf(tiles, city?.tile ?? b.tile),
    battleType: b.kind === 'sack' ? 'sack' : 'raid',
    isAttackingFortification: b.kind === 'sack' && walls > 0,
    defenderDamageReductionMultiplier: b.kind === 'sack' ? getDefenseLevelDamageReductionMultiplier(walls) : 1,
    attackerAgeId: state.nations?.[b.attackerId]?.indep ? state.age || 'bronze' : ageOf(b.attackerId),
    defenderAgeId: ageOf(b.defenderId),
    generals: state.hiredCommanders
  };
};

/** The militia of a sacked city (battleInputs.js): fixed when the battle is queued, so Command and Auto fight the same. */
export const raidMilitia = (state, b) => (b.kind === 'sack' ? cityMilitia(state, b.cityId ?? b.city?.id) : []);

/** Fight a raid battle on Auto (the honest auto-resolve). `b`: as raidBattleContext plus attackerUnits, defenderUnits, militia. */
export const fightRaidAuto = (state, b, rng) => {
  const ctx = raidBattleContext(state, b);
  const cityId = b.kind === 'sack' ? (b.cityId ?? b.city?.id ?? null) : null;
  return resolveAutoBattle(state, { attackerUnits: b.attackerUnits, defenderUnits: b.defenderUnits, ...ctx }, { kind: b.kind, cityId, militia: b.militia ?? null }, rng);
};

/** Where a raid battle is anchored on the map: the sacked city, else the city whose land the tile is (or the defenders' base). */
export const raidRegionOf = (state, b) => (b.kind === 'sack' ? (b.cityId ?? b.city?.id) : state.world?.tileOwner?.[b.tile] ?? b.defenderUnits?.[0]?.regionId ?? null);

/**
 * The BattleOutcome of a raid battle for the outcome service. `opts`: { id, defenseId, mode,
 * viewerId, rngSeed, xpBonusById, attackerStart, defenderStart }.
 */
export const raidOutcome = (state, b, battle, opts = {}) => {
  const meta = {
    kind: b.kind, raidKind: b.raidKind || b.kind, mode: opts.mode, warId: null, attackerNationId: b.attackerId, defenderNationId: b.defenderId,
    viewerId: opts.viewerId, defenseId: opts.defenseId ?? null, regionId: raidRegionOf(state, b), tile: b.tile ?? null,
    attackerStart: opts.attackerStart || b.attackerUnits, defenderStart: opts.defenderStart || b.defenderUnits, militia: b.militia || [],
    xpBonusById: opts.xpBonusById ?? null, rngSeed: opts.rngSeed
  };
  return makeBattleOutcome({ ...meta, id: opts.id || battleIdOf(state, { ...meta, seed: opts.rngSeed ?? state.rngSeed }) }, battle);
};

/**
 * Fights one raid battle on Auto and returns its BattleOutcome plus the old RaidBattleOutcome
 * fields (raidersWon, attackerLoss, defenderLoss), for callers that apply it themselves (raids.js).
 */
export const fightRaidBattle = (state, b, rng, opts = {}) => {
  const battle = fightRaidAuto(state, b, rng);
  const outcome = raidOutcome(state, b, battle, { mode: 'auto', ...opts });
  return { ...outcome, raidersWon: outcome.outcome === 'attacker', attackerLoss: Math.round(sum(b.attackerUnits) - sum(battle.attackerUnits)), defenderLoss: Math.round(sum(b.defenderUnits) - sum(battle.defenderUnits.filter((u) => !u.militia))) };
};

/**
 * A sack the raiders won burns the town (6.5, 6.8): what they burned in the battle, plus at least
 * the best building (by tier, then id) and a size's worth of houses (ceil(houses / size), the first
 * standing ones by id). Returns the { destroyed, damaged } report the outcome service carries to
 * the map under the 50% rule, or the battle's own damage when the raiders lost. `report`: the
 * battle's cityDamage (or null). Pure of the manifest.
 */
export const sackBurn = (manifest, { size = 1, ruined = {}, report = null, razed = [], raidersWon = false } = {}) => {
  const destroyed = new Set(report?.destroyed || []);
  razed.forEach((c) => destroyed.add(`bld-${c}`));
  const damaged = (report?.damaged || []).filter((id) => !destroyed.has(id));
  if (!raidersWon || !manifest?.structures?.length) return { destroyed: [...destroyed], damaged };
  const buildings = manifest.structures.filter((s) => s.kind === 'building').sort((a, b) => (b.tier || 0) - (a.tier || 0) || (a.id < b.id ? -1 : 1));
  if (buildings.length && !buildings.some((s) => destroyed.has(s.id))) destroyed.add(buildings[0].id);
  const houses = manifest.structures.filter((s) => s.kind === 'house' && !ruined[s.id]);
  const want = Math.ceil(manifest.structures.filter((s) => s.kind === 'house').length / Math.max(1, size));
  let burned = houses.filter((s) => destroyed.has(s.id)).length;
  houses.forEach((s) => { if (burned < want && !destroyed.has(s.id)) { destroyed.add(s.id); burned += 1; } });
  return { destroyed: [...destroyed].sort(), damaged };
};

/** The sack's damage to the real city from an outcome (the outcome service, row 20). */
export const sackCityDamage = (state, o) => {
  const city = state.regions[o.regionId];
  const manifest = cityManifestOf(state, o.regionId);
  if (!city || !manifest) return null;
  return sackBurn(manifest, { size: city.size || 1, ruined: cityDamageOf(city).ruined || {}, report: o.cityDamage, razed: o.razed || [], raidersWon: o.outcome === 'attacker' });
};

/**
 * A raid battle against the player, queued (battleQueue.js) for Command or Auto. `b`: { kind,
 * raidKind ('pillage' | 'route' | 'settler' | 'outpost' | 'sack' | 'intercept'), attackerId,
 * defenderId, tile, cityId, attackerUnits, defenderUnits }.
 */
export const raidRecord = (state, b, seed) => ({
  id: `rd_${state.turnNumber}_${b.attackerId}_${b.tile}`,
  kind: b.kind, raidKind: b.raidKind || b.kind, warId: null, aggressorId: b.attackerId,
  tile: b.tile, cityId: b.kind === 'sack' ? (b.cityId ?? null) : null,
  // The player's city the battle is about (the sacked city, the land it is fought on, or the defenders' base).
  regionId: raidRegionOf(state, b),
  fromTile: b.fromTile ?? null,
  attackerUnitIds: b.attackerUnits.map((u) => u.id), defenderUnitIds: b.defenderUnits.map((u) => u.id),
  militia: raidMilitia(state, b), synthetic: [], seed: seed >>> 0, turn: state.turnNumber
});

/** A queued raid's armies as they stand now: { attackerUnits, defenderUnits } (the raiders still in the party, the defenders still there). */
export const queuedRaidArmies = (state, def) => {
  const attackerUnits = def.attackerUnitIds.map((id) => state.units[id]).filter((u) => u && u.strength > 0 && u.ownerId === def.aggressorId);
  const defenderUnits = def.defenderUnitIds.map((id) => state.units[id]).filter((u) => u && u.strength > 0 && !u.embarkedOn);
  return { attackerUnits, defenderUnits };
};

/** The raid battle spec of a queued record. */
export const raidSpecOf = (state, def, armies = queuedRaidArmies(state, def)) => ({
  kind: def.kind, raidKind: def.raidKind, attackerId: def.aggressorId, defenderId: state.playerNationId, tile: def.tile, cityId: def.cityId,
  attackerUnits: armies.attackerUnits, defenderUnits: armies.defenderUnits, militia: def.militia || [], fromTile: def.fromTile ?? null
});
