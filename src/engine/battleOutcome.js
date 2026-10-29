// src/engine/battleOutcome.js
// The one battle outcome service (plans/MASTER-PLAN.md 6.7; RTS plan 9.1). Every battle path
// (a commanded real-time battle, the auto-resolve, a field battle, a sea battle, an invasion, a
// defence, a landing, the player's or an AI's) ends in ONE call:
//
//   applyBattleOutcome(state, outcome) -> state
//
// `outcome` is a BattleOutcome (makeBattleOutcome below): the operation id, the kind, the nations,
// where, the result, each side's campaign units after the battle (with how they left the field),
// and the commanded battle's extras (the city's damage by manifest id, XP bonus).
// It is idempotent: an outcome whose id was already applied returns the state untouched
// (state.appliedBattleIds, the last APPLIED_MEMORY ids, an optional save field), so a result
// sent twice never pays twice. Command and Auto of the same operation share the id, so only one
// of them can ever land.
//
// Each row of master plan 6.7 is applied exactly once, in this order:
//   5  XP for the units that fought (XP_WIN / XP_LOSE x the general's multiplier, plus the
//      command bonus, capped by the sanitizer)
//   2, 3, 6.9  the kind's adapter: who stands where. City kinds run the siege control and the melee
//      rule (siege.js: only infantry and cavalry occupy, never aircraft or workers) and, on a
//      capture, the conquest (conquest.js: control 25, unrest 50, loyalty, AE, claims, capital
//      moves). Field battles are decisive (6.9): the loser's units still on the field are
//      destroyed, the ones that left by an exit survive and step back one tile.
//   1  war score: one recordBattle per battle (diplomacy.js)
//   5, 21  the aftermath (aftermath.js) for every kind: casualty scars, devastation where it was
//      fought (half off a coast for a sea battle), war exhaustion, and the shared general death rule
//      (COMMANDER_FALL_CHANCE on a destroyed unit, the same roll for Auto and Command)
//   20 the city's damage by manifest id under the 50% rule (cityManifest.js), never building razing;
//      a sack the raiders won burns the town under the same rule (raidBattle.js sackBurn)
//   13 lastBattleTurn on every survivor and the BATTLE_MARK_TURNS mark on the battle's tile
//   11 plague contact: survivors of a battle at an infected city carry it home (plague.js)
//   15 each nation's battle record (won, lost, cities taken), read by the research boosts
//   14 the player's battle report, named (battleName.js), and the log line. The report's rows are
//      the participant ledger (battleLedger.js), checked here against the committed map: before =
//      after + fallen + fled on each side, no destroyed regiment left standing, no survivor made
//      whole. The Log's losses, the report sheet and the result screen all read that one ledger.
// The inputs rows (4, 7, 8, 9, 10, 11, 12, 16, 18, 19) live in battleInputs.js, and row 22 (the
// odds and the scouts' guess for the pre-battle screen) in battleOdds.js and intel.js. Pure.
import { LogTypes } from '../data/types';
import { msg, sub, people, cityRef, place as placeRef, thing } from './messages';
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { lawRulesOf } from './lawRules';
import { grantBattleRenown } from './renown';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { getTiles } from '../data/geo/tiles';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { recordBattle } from './diplomacy';
import { conquerRegion } from './conquest';
import { applyBattleAftermath } from './aftermath';
import { recordBattleReport } from './battleReports';
import { checkLedger, ledgerOf, menOf } from './battleLedger';
import { cityManifestOf, applyCityBattleDamage } from './cityManifest';
import { hasMeleeUnitDeployed, isGarrisonBroken, resolveSiegeControlDamage, SIEGE_CONTROL_DAMAGE, SIEGE_CAPTURE_CONTROL_THRESHOLD } from './siege';
import { findTilePath, passableTile, placeInCity, regionForTile, unitTile, nearestHeldCity } from './armies';
import { isAir } from './airPower';
import { battleNameOf } from './battleName';
import { addGrudge } from './grudges';
import { isIndependentNation, GRUDGE_ATTACKED, SACK_INCOME_TURNS, SACK_MIN_GOLD } from '../data/independents';
import { canAnnex } from './stonePhase';
import { goldIn, addGoldIn } from './mercenaries';
import { seaPassable, fleetAge, enemyFleetAt } from './fleets';
import { mapEffectsFor } from './techMapEffects';
import { sackCityDamage } from './raidBattle';
import { cityFell, openCapture } from './capture';
import { spendBattleCards } from '../data/battleCards';
import { copyTileMap } from './world/tileIndex';

export const OUTCOME_VERSION = 1;
export const APPLIED_MEMORY = 64;
export const XP_WIN = 30;
export const XP_LOSE = 15;
export const BATTLE_MARK_TURNS = 5;
export const PLAGUE_CONTACT_TURNS = 2;
export const PLAGUE_CONTACT_I = 0.02;
export const NAVAL_DEVASTATION_SCALE = 0.5;
export const OUTCOME_KINDS = ['invasion', 'landing', 'defense', 'field', 'naval', 'suppress', 'lane', 'raid', 'sack'];

const sum = (units) => (units || []).reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
const xpFor = (side, outcome) => (outcome === side ? XP_WIN : outcome === 'stalemate' || outcome === 'draw' ? Math.round((XP_WIN + XP_LOSE) / 2) : XP_LOSE);

/** A stable id for a battle that has no pending record: the kind, the turn, the nations, the place and the seed. */
export const battleIdOf = (state, { kind, attackerNationId, defenderNationId, regionId = null, tile = null, seed = state.rngSeed }) =>
  `${kind}:${state.turnNumber}:${attackerNationId}>${defenderNationId}@${regionId ?? `t${tile}`}:${seed >>> 0}`;

/** Has this battle's outcome already been applied? */
export const isBattleApplied = (state, id) => !!id && (state.appliedBattleIds || []).includes(id);

/**
 * A BattleOutcome from a resolveBattle-shaped result ({ outcome, attackerUnits, defenderUnits,
 * report }, the shape both the auto-resolve and src/battle/sim/result.js produce). `meta`: { id,
 * kind, mode, warId, attackerNationId, defenderNationId, viewerId, fromRegionId, regionId, tile,
 * fromTile, navalUnitId, defenseId, isDefended, decisive, pressure, xpBonusById, rngSeed,
 * attackerStart, defenderStart (the units as they went in, for field and naval) }.
 */
export const makeBattleOutcome = (meta, battle) => {
  const report = battle?.report || {};
  const tactical = report.tactical || {};
  return {
    v: OUTCOME_VERSION,
    mode: tactical.mode === 'command' ? 'command' : (meta.mode || 'auto'),
    ...meta,
    outcome: battle?.outcome || 'defender',
    attackerUnits: battle?.attackerUnits || [],
    defenderUnits: battle?.defenderUnits || [],
    deployedAttackerIds: report.deployedAttackerIds || [],
    deployedDefenderIds: report.deployedDefenderIds || [],
    decisive: !!(meta.decisive ?? tactical.decisive),
    xpBonusById: meta.xpBonusById ?? tactical.xpBonusById ?? null,
    cityDamage: tactical.cityDamage || report.cityDamage || null,
    razed: tactical.razed || [],
    economy: tactical.economy || null,
    report
  };
};

// ---- row 5: XP ----------------------------------------------------------------------------

const awardSideXp = (state, o, units, deployedIds, amount) => units.map((u) => {
  if (!deployedIds.includes(u.id) || u.militia || u.synthetic) return u;
  const gained = Math.round(amount * getGeneralXpMultiplier(state.hiredCommanders?.[u.commanderId])) + (o.xpBonusById?.[u.id] || 0);
  return awardXp(u, gained);
});

// ---- the kinds ----------------------------------------------------------------------------

const isCentre = (state, tile) => state.regions[state.world?.tileOwner?.[tile]]?.tile === tile;

// Where a stack falls back to from `tile`: the first step towards its base, else any adjacent
// passable tile with no enemy on it and not a city centre, else nowhere.
const stepBack = (state, tile, unit, blocked) => {
  const tiles = getTiles();
  if (tile == null) return null;
  const base = state.regions[unit.regionId];
  if (base?.tile != null && base.tile !== tile) {
    const p = findTilePath(state, tile, base.tile, unit.ownerId, { maxSteps: 40 });
    if (p.path && p.path[1] != null && !blocked.has(p.path[1]) && !isCentre(state, p.path[1])) return p.path[1];
  }
  return tiles.neighbors[tile].find((n) => passableTile(tiles, n) && !blocked.has(n) && !isCentre(state, n)) ?? null;
};

/** How a unit left the battle: dead, fled (by an exit), field (still on the field at the end), reserve (never entered). */
export const dispositionOf = (u, loser) => {
  if (!(u.strength > 0)) return 'dead';
  if (u.disposition) return u.disposition;
  if (u.fled) return 'fled';
  // A result without dispositions (an older client, a test): the loser's survivors withdrew.
  return loser ? 'fled' : 'field';
};

// A city taken, attacked or held: the siege control and the melee rule (siege.js).
const siegeOf = (o, region) => {
  const hasMeleeUnit = hasMeleeUnitDeployed(o.attackerUnits.filter((u) => u.strength > 0 && !u.routed && !u.militia));
  const garrisonBroken = isGarrisonBroken(o.defenderUnits);
  if (!o.isDefended) return { nextControl: region.control, captured: o.outcome === 'attacker', hasMeleeUnit };
  if (o.pressure == null || (o.outcome === 'attacker' && garrisonBroken)) return { ...resolveSiegeControlDamage({ currentControl: region.control, outcome: o.outcome, hasMeleeUnit, garrisonBroken }), hasMeleeUnit };
  // An auto-resolved assault on a garrison (defense.js getAssaultPressure): the damage follows the exchange.
  const damaged = Math.max(0, (region.control || 0) - Math.round(SIEGE_CONTROL_DAMAGE.attacker * o.pressure));
  if (o.pressure <= 0 || damaged > SIEGE_CAPTURE_CONTROL_THRESHOLD) return { nextControl: damaged, captured: false, hasMeleeUnit };
  return hasMeleeUnit ? { nextControl: damaged, captured: true, hasMeleeUnit } : { nextControl: SIEGE_CAPTURE_CONTROL_THRESHOLD, captured: false, hasMeleeUnit };
};

// Auto against a city (cityAssault.js, the user's rule of 14 October): an Auto battle against the
// units in a city never takes it (`garrisonFirst`); an Auto attack on an empty city takes it only
// when it brought the city's HP to 0 (`cityAttack.falls`) and the attackers can hold it. A
// commanded battle is untouched: winning it takes the city (decision 40).
const autoCityRule = (o) => (o.mode === 'command' ? null : o.report?.cityAttack ? 'attack' : o.report?.garrisonFirst ? 'garrison' : null);
const cityCaptured = (s, o, siege) => {
  if (!canAnnex(s, o.attackerNationId)) return false; // a Stone raid takes loot, not the city (stonePhase.js)
  const rule = autoCityRule(o);
  if (rule === 'garrison') return false;
  if (rule === 'attack') return !!o.report.cityAttack.falls && siege.hasMeleeUnit;
  return cityFell(o, { occupier: siege.hasMeleeUnit, fell: siege.captured || (o.decisive && o.outcome === 'attacker') });
};
// The city after an Auto attack that did not take it: its HP down on the siege record (healed by
// sieges.js once nobody besieges or attacks it), the attack remembered.
const attackedCity = (s, o, region) => {
  const a = o.report.cityAttack;
  const siege = { startedTurn: s.turnNumber, encircled: false, by: null, ...(region.siege || {}), hp: a.hpAfter, maxHp: a.maxHp };
  return { ...region, siege, lastAttackedTurn: s.turnNumber };
};
const cityAttackLine = (s, o, place, mine) => {
  const a = o.report.cityAttack;
  const who = mine ? sub('m.battle.yourArmy') : nameRef(s, o.attackerNationId);
  return a.hpAfter <= 0
    ? msg('m.battle.cityDefencesBroken', { who, city: place, maxHp: a.maxHp })
    : msg('m.battle.cityDefencesFall', { who, city: place, hpBefore: a.hpBefore, hpAfter: a.hpAfter, maxHp: a.maxHp });
};
// Only say "driven out" when somebody survived to be driven (LOGIC-02): a garrison cut down to the
// last man is destroyed, not driven.
const garrisonLine = (s, o, place, mine, def = []) => (o.outcome === 'attacker'
  ? msg(def.some((u) => u.strength > 0) ? 'm.battle.garrisonDrivenOut' : 'm.battle.garrisonDestroyed', { who: mine ? sub('m.battle.yourArmy') : nameRef(s, o.attackerNationId), city: place })
  : null);
// A garrison beaten on Auto is driven out of its city (it breaks, as a Civilization unit dies or
// falls back): the survivors fall back to the owner's nearest held city, or are lost with nowhere to
// go; aircraft stay at their base. The city stands empty for the next attack on its defences.
const beatenGarrison = (s, o) => {
  const fallback = nearestHeldCity(s, o.regionId, o.defenderNationId);
  return (u) => {
    if (isAir(u) || u.domain === 'naval') return { ...u };
    return fallback ? { ...placeInCity(u, s.regions, fallback), movesLeft: 0, route: null } : null;
  };
};

const conquer = (s, regionId, conquerorId, war) => {
  const r = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, regionId, conquerorId, war);
  // A taken city's battered defences are its new owner's to mend: the siege record goes.
  const regions = r.regions[regionId]?.siege ? { ...r.regions, [regionId]: { ...r.regions[regionId], siege: null } } : r.regions;
  return { regions, nations: r.nations, capitalTaken: r.capitalTaken };
};

// A nation in a message (messages.js): the rebels are words, not a people.
const nameRef = (s, id) => (id === REBEL_OWNER_ID ? sub('m.battle.theRebels') : people(id, s.nations[id]?.name || id));
// A city in a message: its name, else the fallback words (`fallbackKey`), else its id.
const cityOr = (regions, id, fallbackKey = null) => (regions?.[id]?.name ? cityRef(id, regions[id].name) : fallbackKey ? sub(fallbackKey) : cityRef(id, id));
// A list of names in a message: "a, b, c".
const listOf = (refs) => refs.reduce((acc, r) => (acc == null ? r : sub('m.battle.listComma', { a: acc, b: r })), null) ?? '';

// An assault on a city from the land (the player's or an AI's invasion).
const invasionAdapter = (s, o, war, att, def) => {
  const target = s.regions[o.regionId];
  const siege = siegeOf(o, target);
  const captured = cityCaptured(s, o, siege);
  const rule = autoCityRule(o);
  const units = { ...s.units };
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { delete units[u.id]; return; }
    const stays = isAir(u); // aircraft fly home
    // A unit that stood by from another city keeps its own (battleInputs.js standbyFor).
    const home = u.regionId === o.fromRegionId || !u.regionId ? o.fromRegionId : u.regionId;
    units[u.id] = { ...u, regionId: stays ? u.regionId : captured ? o.regionId : home, tile: stays ? unitTile(s, u) : captured ? target.tile : unitTile(s, u), movesLeft: 0 };
  });
  const out = rule === 'garrison' && o.outcome === 'attacker' ? beatenGarrison(s, o) : null;
  def.forEach((u) => {
    if (!units[u.id]) return; // the militia and synthetic troops live on the battle only
    // Troops that stood by outside the city take their losses where they stand; the city's own fall with it or are driven out.
    const inCity = units[u.id].regionId === o.regionId;
    if ((captured && inCity) || u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = out && inCity ? out(u) : { ...u };
    if (!units[u.id]) delete units[u.id];
  });
  let { regions, nations } = s; let capitalTaken = false;
  if (captured) ({ regions, nations, capitalTaken } = conquer({ ...s, units }, o.regionId, o.attackerNationId, war));
  else if (rule === 'attack') regions = { ...regions, [o.regionId]: attackedCity(s, o, target) };
  else if (o.isDefended) regions = { ...regions, [o.regionId]: { ...target, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: true } };
  const place = cityRef(o.regionId, target.name || o.regionId);
  const me = o.attackerNationId === o.viewerId;
  const capital = capitalTaken ? sub('m.battle.capitalFallen') : '';
  const line = captured
    ? (me ? msg('m.battle.conqueredMine', { city: place, from: nameRef(s, target.owner), capital }) : msg('m.battle.conquered', { city: place, from: nameRef(s, target.owner), by: nameRef(s, o.attackerNationId), capital }))
    : rule === 'attack' ? cityAttackLine(s, o, place, me)
    : rule === 'garrison' && garrisonLine(s, o, place, me, def) ? garrisonLine(s, o, place, me, def)
    : o.outcome === 'attacker' ? msg('m.battle.brokeThrough', { who: me ? sub('m.battle.yourForces') : nameRef(s, o.attackerNationId), city: place, control: siege.nextControl })
      : o.outcome === 'defender' ? (me ? msg('m.battle.invasionRepelledMine', { city: place }) : msg('m.battle.invasionRepelled', { nation: nameRef(s, o.attackerNationId), city: place }))
        : msg('m.battle.invasionWithdrawal', { city: place });
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  return { units, regions, nations, captured, capitalTaken, ...line, score: winnerId ? { winnerId, share: captured ? 0.4 : 0.2 } : null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: target.tile };
};

// A landing from the sea: survivors go ashore only once the city is taken; else back aboard.
const landingAdapter = (s, o, war, att, def) => {
  const target = s.regions[o.regionId];
  const siege = siegeOf(o, target);
  const captured = cityCaptured(s, o, siege);
  const rule = autoCityRule(o);
  const units = { ...s.units };
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = captured
      ? { ...u, regionId: o.regionId, tile: target.tile ?? null, embarkedOn: null, movesLeft: 0 }
      : { ...u, regionId: o.fromRegionId, embarkedOn: o.navalUnitId, movesLeft: 0 };
  });
  const out = rule === 'garrison' && o.outcome === 'attacker' ? beatenGarrison(s, o) : null;
  def.forEach((u) => {
    if (!units[u.id]) return;
    if (captured || u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = out ? out(u) : { ...u };
    if (!units[u.id]) delete units[u.id];
  });
  if (units[o.navalUnitId]) units[o.navalUnitId] = { ...units[o.navalUnitId], movesLeft: 0, lastBattleTurn: s.turnNumber };
  let { regions, nations } = s; let capitalTaken = false;
  if (captured) ({ regions, nations, capitalTaken } = conquer({ ...s, units }, o.regionId, o.attackerNationId, war));
  else if (rule === 'attack') regions = { ...regions, [o.regionId]: attackedCity(s, o, target) };
  else if (o.isDefended) regions = { ...regions, [o.regionId]: { ...target, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: true } };
  const place = cityRef(o.regionId, target.name || o.regionId);
  const me = o.attackerNationId === o.viewerId;
  const capital = capitalTaken ? sub('m.battle.capitalFallen') : '';
  const enemy = nameRef(s, o.attackerNationId);
  const line = captured
    ? (me ? msg('m.battle.landingConqueredMine', { city: place, from: nameRef(s, target.owner), capital }) : msg('m.battle.landingConquered', { nation: enemy, city: place, from: nameRef(s, target.owner), capital }))
    : rule === 'attack' ? cityAttackLine(s, o, place, me)
    : rule === 'garrison' && garrisonLine(s, o, place, me, def) ? garrisonLine(s, o, place, me, def)
    : o.outcome === 'attacker' ? (me ? msg('m.battle.landingBrokeThroughMine', { city: place, control: siege.nextControl }) : msg('m.battle.landingBrokeThrough', { nation: enemy, city: place, control: siege.nextControl }))
      : o.outcome === 'defender' ? (me ? msg('m.battle.landingRepelledMine', { city: place }) : msg('m.battle.landingRepelled', { nation: enemy, city: place }))
        : msg('m.battle.landingWithdrawal', { city: place });
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  return { units, regions, nations, captured, capitalTaken, ...line, score: winnerId ? { winnerId, share: captured ? 0.4 : 0.2 } : null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: target.tile, reportKind: 'amphibious' };
};

// An assault on a city whose defender was asked first (defense.js): the queued defence record.
const defenseAdapter = (s, o, war, att, def, record) => {
  const region = s.regions[o.regionId];
  const siege = siegeOf(o, region);
  const captured = cityCaptured(s, o, siege);
  const rule = autoCityRule(o);
  const damaged = siege.nextControl < (region.control || 0);
  const pressure = rule === 'attack' ? null : o.pressure;
  const aggressorWon = pressure == null ? o.outcome === 'attacker' : pressure >= 0.5;
  const defenderWon = pressure == null ? o.outcome === 'defender' : pressure < 0.5;
  const units = { ...s.units };
  // A garrison beaten on Auto is driven out like a captured city's (beatenGarrison), but the city stands.
  const drivenOut = rule === 'garrison' && aggressorWon;
  const fallback = captured || drivenOut ? nearestHeldCity(s, o.regionId, o.defenderNationId) : null;
  def.forEach((u) => {
    if (!units[u.id]) return;
    // Troops that stood by outside the city (battleInputs.js standbyFor) stay where they are.
    const leaves = (captured || (drivenOut && !isAir(u))) && units[u.id].regionId === o.regionId;
    if (u.strength <= 0 || (leaves && !fallback)) { delete units[u.id]; return; }
    const next = { ...units[u.id], strength: u.strength, morale: u.morale, xp: u.xp, rank: u.rank, promotions: u.promotions };
    units[u.id] = leaves ? { ...placeInCity(next, s.regions, fallback), ...(drivenOut ? { route: null, movesLeft: 0 } : {}) } : next;
  });
  // The aggressor's real troops take their losses where they stand; synthetic ones fold back
  // into militaryStrength minus what they lost.
  let syntheticLoss = 0;
  att.forEach((u) => {
    if (u.synthetic) {
      const start = (record?.synthetic || []).find((x) => x.id === u.id)?.strength || 0;
      syntheticLoss += Math.max(0, start - Math.max(0, u.strength));
      return;
    }
    if (!units[u.id]) return;
    if (u.strength <= 0) delete units[u.id];
    else units[u.id] = { ...(captured ? placeInCity(units[u.id], s.regions, o.regionId) : units[u.id]), strength: u.strength, morale: u.morale, xp: u.xp, rank: u.rank, promotions: u.promotions, movesLeft: 0 };
  });
  const aggressor = s.nations[o.attackerNationId];
  let nations = aggressor && syntheticLoss > 0
    ? { ...s.nations, [o.attackerNationId]: { ...aggressor, militaryStrength: Math.max(100, (aggressor.militaryStrength || 0) - syntheticLoss) } }
    : s.nations;
  let regions = s.regions; let capitalTaken = false;
  if (captured) ({ regions, nations, capitalTaken } = conquer({ ...s, nations, units }, o.regionId, o.attackerNationId, war));
  else if (rule === 'attack') regions = { ...regions, [o.regionId]: attackedCity(s, o, region) };
  else regions = { ...regions, [o.regionId]: { ...region, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: damaged } };
  const name = cityRef(o.regionId, region.name || o.regionId);
  const survivors = def.some((u) => u.strength > 0 && !isAir(u));
  const enemy = nameRef(s, o.attackerNationId);
  const mine = o.defenderNationId === o.viewerId;
  const back = fallback ? cityRef(fallback, s.regions[fallback]?.name || fallback) : null;
  const line = captured
    ? msg('m.battle.stormsCity', { enemy, city: name, fallback: back ? sub(mine ? 'm.battle.survivorsFallBackMine' : 'm.battle.survivorsFallBack', { city: back }) : '' })
    : rule === 'attack' ? cityAttackLine(s, o, name, false)
    : drivenOut ? (survivors
      ? msg(mine ? 'm.battle.beatsGarrisonMine' : 'm.battle.beatsGarrison', { enemy, city: name, back: back ? sub('m.battle.drivesBack', { city: back }) : '' })
      : msg(mine ? 'm.battle.destroysGarrisonMine' : 'm.battle.destroysGarrison', { enemy, city: name }))
    : damaged ? msg(mine ? 'm.battle.pressesSiegeMine' : 'm.battle.pressesSiege', { enemy, city: name, control: siege.nextControl })
      : msg(mine ? 'm.battle.garrisonRepelsMine' : 'm.battle.garrisonRepels', { enemy, city: name });
  const winnerId = aggressorWon ? o.attackerNationId : defenderWon ? o.defenderNationId : null;
  return {
    units, regions, nations, captured, capitalTaken, ...line,
    score: winnerId ? { winnerId, share: aggressorWon ? (captured ? 0.3 : 0.15) : 0.2 } : null,
    aftermathOutcome: pressure == null ? o.outcome : aggressorWon ? 'attacker' : defenderWon ? 'defender' : 'draw',
    aftermathRegionId: o.regionId, markTile: region.tile, reportExtra: { defense: true }
  };
};

// A field battle on a tile (fieldBattle.js), decisive (6.9).
const fieldAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  const loser = o.outcome === 'attacker' ? 'defender' : o.outcome === 'defender' ? 'attacker' : null;
  const attackerTiles = new Set((o.attackerStart || att).map((u) => unitTile(s, s.units[u.id] || u)).filter((t) => t != null));
  const defenderTiles = new Set([o.tile]);
  let destroyed = 0; let fledBack = 0;
  const apply = (list, side) => {
    let shared = null; // a stack falls back together
    list.forEach((u) => {
      if (!units[u.id]) return;
      if (u.strength <= 0) { delete units[u.id]; return; }
      const base = { ...units[u.id], ...u, routed: undefined, fled: undefined, disposition: undefined, lastBattleTurn: s.turnNumber };
      if (side === 'attacker') base.movesLeft = 0;
      if (isAir(u)) { units[u.id] = base; return; }
      const how = dispositionOf(u, side === loser);
      if (how === 'reserve' || (side !== loser && how !== 'fled')) { units[u.id] = base; return; }
      if (how === 'field') { delete units[u.id]; destroyed += 1; return; }
      // Left by an exit: one tile back, away from the enemy.
      const from = side === 'defender' ? o.tile : unitTile(s, s.units[u.id]);
      const blocked = side === 'defender' ? attackerTiles : defenderTiles;
      const to = shared ?? stepBack(s, from, s.units[u.id], blocked);
      if (to == null) {
        if (side === 'defender' && side === loser) { delete units[u.id]; destroyed += 1; return; }
        units[u.id] = base; return;
      }
      shared = to; fledBack += 1;
      units[u.id] = { ...base, tile: to, regionId: regionForTile(s, to, u.ownerId, u.regionId), movesLeft: 0, route: undefined };
    });
  };
  apply(att, 'attacker');
  apply(def, 'defender');
  const attStart = sum(o.attackerStart); const defStart = sum(o.defenderStart);
  const attLoss = attStart - sum(o.attackerUnits); const defLoss = defStart - sum(o.defenderUnits);
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  const tileName = getTiles().names?.[o.tile];
  const where = tileName ? placeRef(tileName) : cityOr(s.regions, s.world?.tileOwner?.[o.tile], 'm.battle.theField');
  const mine = o.attackerNationId === o.viewerId;
  const enemy = nameRef(s, o.defenderNationId);
  const line = o.outcome === 'attacker' ? msg('m.battle.fieldWon', { who: mine ? sub('m.battle.yourArmy') : nameRef(s, o.attackerNationId), enemy: mine || o.defenderNationId !== o.viewerId ? enemy : sub('m.battle.yourArmyLower'), place: where, destroyed: destroyed ? sub(destroyed > 1 ? 'm.battle.fieldDestroyingMany' : 'm.battle.fieldDestroyingOne', { n: destroyed }) : '' })
    : o.outcome === 'defender' ? msg('m.battle.fieldThrownBack', { who: mine ? sub('m.battle.yourAttack') : sub('m.battle.theirAttack', { nation: nameRef(s, o.attackerNationId) }), place: where, byYou: o.defenderNationId === o.viewerId ? sub('m.battle.byYourArmy') : '', lost: destroyed ? sub(destroyed > 1 ? 'm.battle.fieldLostMany' : 'm.battle.fieldLostOne', { n: destroyed }) : '' })
      : msg('m.battle.fieldSpent', { place: where });
  return {
    units, regions: s.regions, nations: s.nations, captured: false, ...line, destroyed, fledBack,
    score: winnerId && (war || o.warId) ? { winnerId, share: o.outcome === 'attacker' ? (defStart ? defLoss / defStart : 0) : (attStart ? attLoss / attStart : 0) } : null,
    aftermathOutcome: o.outcome, aftermathRegionId: s.world?.tileOwner?.[o.tile] ?? o.regionId, markTile: o.tile
  };
};

// Where a beaten fleet on `tile` falls back to: a neighbouring sea tile it may sail, with no enemy
// fleet on it and not one the attackers came from; else nowhere (it is sunk).
const seaStepBack = (state, tile, unit, attackerTiles) => {
  const tiles = getTiles();
  const ageId = fleetAge(state, unit.ownerId);
  const fx = mapEffectsFor(state, unit.ownerId);
  return tiles.neighbors[tile].find((n) => seaPassable(tiles, n, ageId, fx.deepOcean > 0, fx.deepOcean > 0) && !attackerTiles.has(n) && !enemyFleetAt(state, n, unit.ownerId)) ?? null;
};

// A sea battle (navalBattle.js): a sunk ship takes its cargo down; a beaten defender falls back a sea tile or sinks.
const navalAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  const sink = (id) => { delete units[id]; Object.values(units).forEach((c) => { if (c.embarkedOn === id) delete units[c.id]; }); };
  let sunk = 0;
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { sink(u.id); return; }
    units[u.id] = { ...units[u.id], ...u, routed: undefined, fled: undefined, disposition: undefined, movesLeft: 0 };
  });
  const attackerTiles = new Set((o.attackerStart || att).map((u) => unitTile(s, s.units[u.id] || u)));
  let retreated = null;
  def.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { sink(u.id); sunk += 1; return; }
    const next = { ...units[u.id], ...u, routed: undefined, fled: undefined, disposition: undefined };
    if (o.outcome === 'attacker') {
      const to = retreated ?? seaStepBack(s, o.tile, u, attackerTiles);
      if (to == null) { sink(u.id); sunk += 1; return; }
      retreated = to;
      units[u.id] = { ...next, tile: to, regionId: regionForTile(s, to, u.ownerId, u.regionId), movesLeft: 0, route: undefined };
      Object.values(units).forEach((c) => { if (c.embarkedOn === u.id) units[c.id] = { ...c, tile: to, regionId: units[u.id].regionId }; });
    } else units[u.id] = next;
  });
  const attStart = sum(o.attackerStart); const defStart = sum(o.defenderStart);
  const attLoss = attStart - sum(o.attackerUnits); const defLoss = defStart - sum(o.defenderUnits);
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  const anchor = o.regionId;
  const where = s.regions[anchor]?.name ? sub('m.battle.offCity', { city: cityRef(anchor, s.regions[anchor].name) }) : sub('m.battle.atSea');
  const mine = o.attackerNationId === o.viewerId;
  const who = mine ? sub('m.battle.yourFleet') : sub('m.battle.theirFleet', { nation: nameRef(s, o.attackerNationId) });
  const line = o.outcome === 'attacker' ? msg('m.battle.seaWon', { who, enemy: mine || o.defenderNationId !== o.viewerId ? nameRef(s, o.defenderNationId) : sub('m.battle.yourFleetLower'), where, sunk: sunk ? sub(sunk > 1 ? 'm.battle.sinkingMany' : 'm.battle.sinkingOne', { n: sunk }) : '' })
    : o.outcome === 'defender' ? msg('m.battle.seaBeatenOff', { who: mine ? sub('m.battle.yourAttack') : sub('m.battle.theirAttack', { nation: nameRef(s, o.attackerNationId) }), where, byYou: o.defenderNationId === o.viewerId ? sub('m.battle.byYourFleet') : '' })
      : msg('m.battle.seaSpent', { where });
  return {
    units, regions: s.regions, nations: s.nations, captured: false, ...line, sunk,
    score: winnerId && (war || o.warId) ? { winnerId, share: o.outcome === 'attacker' ? (defStart ? defLoss / defStart : 0) : (attStart ? attLoss / attStart : 0) } : null,
    aftermathOutcome: o.outcome, aftermathRegionId: anchor, devastationScale: NAVAL_DEVASTATION_SCALE, markTile: o.tile
  };
};

// The garrison of a city attacks the rebels inside it (SUPPRESS_REBELLION, row 17): a won battle
// crushes the uprising outright (no survivors to regroup) and calms the city.
const suppressAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  att.forEach((u) => { if (!units[u.id]) return; if (u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u, movesLeft: 0 }; });
  def.forEach((u) => { if (!units[u.id]) return; if (o.outcome === 'attacker' || u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u }; });
  const region = s.regions[o.regionId];
  const regions = o.outcome === 'attacker' && region
    ? { ...s.regions, [o.regionId]: { ...region, unrest: Math.min(region.unrest, REBELLION_UNREST_THRESHOLD - 10), control: Math.min(100, (region.control || 0) + 20) } }
    : s.regions;
  const name = cityRef(o.regionId, region?.name || o.regionId);
  const line = msg(o.outcome === 'attacker' ? 'm.battle.rebellionCrushed' : o.outcome === 'defender' ? 'm.battle.rebellionNotSuppressed' : 'm.battle.rebellionUnclear', { city: name });
  return { units, regions, nations: s.nations, captured: false, ...line, score: null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: region?.tile ?? null, reportKind: 'rebellion' };
};

// Fleets contest the waters by a city (NAVAL_ENGAGEMENT, the region-level sea action): survivors
// hold their own positions, win or lose; there is no ground to take.
const laneAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  att.forEach((u) => { if (!units[u.id]) return; if (u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u, movesLeft: 0 }; });
  def.forEach((u) => { if (!units[u.id]) return; if (u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u }; });
  const attStart = sum(o.attackerStart); const defStart = sum(o.defenderStart);
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  const name = cityRef(o.regionId, s.regions[o.regionId]?.name || o.regionId);
  const line = msg(o.outcome === 'attacker' ? 'm.battle.laneCleared' : o.outcome === 'defender' ? 'm.battle.laneDrivenOff' : 'm.battle.laneInconclusive', { city: name });
  return {
    units, regions: s.regions, nations: s.nations, captured: false, ...line,
    score: winnerId ? { winnerId, share: o.outcome === 'attacker' ? (defStart ? (defStart - sum(o.defenderUnits)) / defStart : 0) : (attStart ? (attStart - sum(o.attackerUnits)) / attStart : 0) } : null,
    aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, devastationScale: NAVAL_DEVASTATION_SCALE, markTile: null, reportKind: 'naval'
  };
};

// A raid or a sack (raidBattle.js, phase R3): raids are not wars (no war score). Beaten raiders
// still on the field are cut down (6.9's rule for the side that lost), the ones that got away by an
// exit live; won, every raider that lived goes on. The defenders keep their survivors where they
// stand (raids.js moves a beaten field force back to its city). The city is never taken.
const raidAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  const raidersLost = o.outcome !== 'attacker';
  let cutDown = 0;
  const keep = (u) => ({ ...units[u.id], strength: u.strength, morale: u.morale ?? units[u.id].morale, xp: u.xp ?? units[u.id].xp, rank: u.rank ?? units[u.id].rank, promotions: u.promotions ?? units[u.id].promotions, routed: undefined, lastBattleTurn: s.turnNumber });
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { delete units[u.id]; return; }
    if (raidersLost && !isAir(u) && dispositionOf(u, true) === 'field') { delete units[u.id]; cutDown += 1; return; }
    units[u.id] = { ...keep(u), movesLeft: 0 };
  });
  def.forEach((u) => {
    if (!units[u.id]) return; // the militia lives on the battle only
    if (u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = keep(u);
  });
  const raiders = nameRef(s, o.attackerNationId);
  const tileName = o.kind === 'sack' ? null : getTiles().names?.[o.tile];
  const place = o.kind === 'sack' ? cityOr(s.regions, o.regionId, 'm.battle.theTown') : tileName ? placeRef(tileName) : cityOr(s.regions, o.regionId, 'm.battle.theFrontier');
  const mine = o.defenderNationId === o.viewerId;
  // Won because nobody was left to defend (step.js raidEnd defendersBroken), not by burning: say so.
  const overrun = o.report?.tactical?.reason === 'defendersBroken';
  const line = o.outcome === 'attacker'
    ? msg(o.kind === 'sack' ? (overrun ? 'm.battle.sackOverrun' : 'm.battle.sackGotAway') : (overrun ? 'm.battle.raidOverrun' : 'm.battle.raidGotAway'), { raiders, place })
    : msg('m.battle.raidDrivenOff', { who: mine ? sub('m.battle.yourTroops') : nameRef(s, o.defenderNationId), raiders, place, cut: cutDown ? sub(cutDown > 1 ? 'm.battle.cutDownMany' : 'm.battle.cutDownOne', { n: cutDown }) : '' });
  return { units, regions: s.regions, nations: s.nations, captured: false, ...line, cutDown, score: null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: o.kind === 'sack' ? s.regions[o.regionId]?.tile ?? o.tile : o.tile, reportKind: o.kind };
};

const ADAPTERS = { raid: raidAdapter, sack: raidAdapter, invasion: invasionAdapter, landing: landingAdapter, defense: defenseAdapter, field: fieldAdapter, naval: navalAdapter, suppress: suppressAdapter, lane: laneAdapter };

// ---- row 20: the city's damage (manifest ids, the 50% rule) -----------------------------------

const applyRazedBuildings = (state, regionId, razed) => {
  const region = state.regions[regionId];
  const lost = [...new Set(razed || [])].filter((c) => (region?.buildings?.categories?.[c] ?? -1) >= 0);
  if (!lost.length) return state;
  const categories = { ...region.buildings.categories };
  lost.forEach((c) => { categories[c] -= 1; });
  const names = listOf(lost.map((c) => thing('building', c, BUILDING_CATEGORIES[c]?.label || c)));
  return {
    ...state,
    regions: { ...state.regions, [regionId]: { ...region, buildings: { ...region.buildings, categories } } },
    logs: [...state.logs, { year: state.year, ...msg('m.battle.buildingsRuined', { city: cityRef(regionId, region.name || regionId), names }), type: LogTypes.COMBAT }]
  };
};

/** The battle's damage to the real city (cityManifest.js) on `after`, read against the manifest the battle loaded (`before`). */
export const applyCityDamage = (before, after, regionId, { cityDamage = null, razed = [] } = {}) => {
  if (!cityDamage) return razed?.length ? applyRazedBuildings(after, regionId, razed) : after;
  const manifest = cityManifestOf(before, regionId);
  if (!manifest || !after.regions[regionId]) return after;
  const occupation = before.regions[regionId]?.owner !== after.regions[regionId].owner;
  const burned = (razed || []).map((c) => `bld-${c}`);
  const { state: next, log, logMsg } = applyCityBattleDamage(after, regionId, { destroyed: [...new Set([...(cityDamage.destroyed || []), ...burned])], damaged: cityDamage.damaged || [] }, { manifest, occupation });
  if (!log) return next;
  // `log` is cityManifest.js's English list of what burned (not converted there yet).
  return { ...next, logs: [...next.logs, { year: next.year, ...msg('m.battle.cityMarked', { city: cityRef(regionId, after.regions[regionId]?.name || regionId), damage: logMsg || log }), type: LogTypes.COMBAT }] };
};

// ---- the service ------------------------------------------------------------------------------

const remember = (state, id) => ({ ...state, appliedBattleIds: [...(state.appliedBattleIds || []), id].slice(-APPLIED_MEMORY) });

const startStrength = (state, o, u) => {
  if (o.beforeById?.[u.id] != null) return o.beforeById[u.id];
  const real = state.units?.[u.id];
  if (real) return real.strength;
  const listed = [...(o.attackerStart || []), ...(o.defenderStart || []), ...(o.synthetic || []), ...(o.militia || [])].find((x) => x.id === u.id);
  return listed?.strength ?? u.maxStrength ?? u.strength ?? 0;
};

// Kinds whose loser is destroyed when left on the field (6.9: field battles, raids and sacks).
const DECISIVE_KINDS = new Set(['field', 'raid', 'sack']);

// For the report's fates (battleReports.js): the units that lived through the fighting but not the
// battle's result. A unit on the map is gone when the adapter removed it; one that lives on the
// battle only (militia, auxiliaries, synthetic troops) when its side lost a decisive battle and it
// was still on the field. Records what the adapters did; decides nothing.
const goneAfter = (state, o, unitsAfter) => {
  const gone = new Set();
  const loser = o.outcome === 'attacker' ? 'defender' : o.outcome === 'defender' ? 'attacker' : null;
  [['attacker', o.attackerUnits], ['defender', o.defenderUnits]].forEach(([side, list]) => (list || []).forEach((u) => {
    if (!(u.strength > 0)) return;
    if (state.units?.[u.id]) { if (!unitsAfter[u.id]) gone.add(u.id); return; }
    if (side === loser && DECISIVE_KINDS.has(o.kind) && dispositionOf(u, true) === 'field') gone.add(u.id);
  }));
  return gone;
};

const recordStats = (nations, o, captured) => {
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  const loserId = winnerId === o.attackerNationId ? o.defenderNationId : winnerId ? o.attackerNationId : null;
  let out = nations;
  const bump = (id, key) => {
    const n = out[id];
    if (!n) return;
    const stats = n.battleStats || { won: 0, lost: 0, taken: 0 };
    out = { ...out, [id]: { ...n, battleStats: { ...stats, [key]: (stats[key] || 0) + 1 } } };
  };
  if (winnerId) bump(winnerId, 'won');
  if (winnerId && (o.kind === 'raid' || o.kind === 'sack')) bump(winnerId, 'raidsWon'); // raids and sacks won, a battle stat
  if (loserId) bump(loserId, 'lost');
  if (captured) bump(o.attackerNationId, 'taken');
  return out;
};

/**
 * Apply one BattleOutcome to the campaign, exactly once. Returns the next state (the same state
 * when this outcome was already applied).
 */
export const applyBattleOutcome = (state, o) => {
  if (!o || !ADAPTERS[o.kind]) return state;
  const id = o.id || battleIdOf(state, { kind: o.kind, attackerNationId: o.attackerNationId, defenderNationId: o.defenderNationId, regionId: o.regionId, tile: o.tile, seed: o.seed ?? state.rngSeed });
  if (isBattleApplied(state, id)) return state;
  const viewerId = o.viewerId ?? state.playerNationId;
  const out = { ...o, id, viewerId };
  // A queued battle (battleQueue.js: a defence, or a field or sea battle the AI started) leaves the
  // queue whatever happens.
  let base = remember(state, id);
  let record = null;
  if (o.defenseId) {
    record = (state.pendingDefenses || []).find((d) => d.id === o.defenseId) || null;
    base = { ...base, pendingDefenses: (state.pendingDefenses || []).filter((d) => d.id !== o.defenseId) };
  }
  const war = o.warId ? (state.wars || []).find((w) => w.id === o.warId && w.active) : null;
  // Peace was signed (or the city changed hands) before the battle was fought: nothing happens.
  if (o.warId && !war) return base;
  if (o.kind === 'invasion' || o.kind === 'landing' || o.kind === 'defense') {
    const region = state.regions[o.regionId];
    if (!region || region.owner !== o.defenderNationId || (o.kind === 'defense' && region.occupiedBy)) return base;
  }
  if (o.kind === 'defense' && !record) return base;

  let s = base;
  // row 5 (XP), then the kind (rows 2, 3, 6.9)
  const xpMult = (side, nationId) => (out.outcome === side ? 1 + (lawRulesOf(s.nations?.[nationId]).battleXpMult || 0) : 1);
  const att = awardSideXp(s, out, out.attackerUnits, out.deployedAttackerIds, xpFor('attacker', out.outcome) * xpMult('attacker', out.attackerNationId));
  const def = awardSideXp(s, out, out.defenderUnits, out.deployedDefenderIds, xpFor('defender', out.outcome) * xpMult('defender', out.defenderNationId));
  const placed = ADAPTERS[o.kind](s, out, war, att, def, record);
  s = { ...s, units: placed.units, regions: placed.regions, nations: placed.nations };
  // U23: the cards the two nations held were in play for this battle (battleInputs.js): spent.
  [out.attackerNationId, out.defenderNationId].forEach((id) => { if (s.nations[id]?.battleCards?.length) s = { ...s, nations: { ...s.nations, [id]: spendBattleCards(s.nations[id]) } }; });

  // row 1: one war-score entry
  // `war.battles` counts every battle fought in the war (telemetry: battles per war, wars with none).
  if (war) s = { ...s, wars: s.wars.map((w) => (w.id === war.id ? { ...w, battles: (w.battles || 0) + 1, ...(placed.score ? { battleScore: recordBattle(w, placed.score.winnerId, placed.score.share, 1 + (lawRulesOf(s.nations?.[placed.score.winnerId]).battleWarScore || 0)) } : {}) } : w)) };

  // rows 5 and 21: the aftermath, every kind
  const beforeA = out.attackerUnits.map((u) => ({ ...(state.units[u.id] || u), strength: startStrength(state, out, u) }));
  const beforeD = out.defenderUnits.map((u) => ({ ...(state.units[u.id] || u), strength: startStrength(state, out, u) }));
  // Who owned the battle's tile before it (a sea fight: its coastal city): the other side fought abroad (rank 10).
  const groundCity = state.world?.tileOwner?.[placed.markTile] ?? (o.kind === 'naval' ? placed.aftermathRegionId : null);
  const aftermath = applyBattleAftermath(s, {
    groundOwner: placed.markTile == null ? undefined : state.regions[groundCity]?.owner ?? null,
    regionId: placed.aftermathRegionId, beforeA, afterA: out.attackerUnits, beforeD, afterD: out.defenderUnits,
    attackerId: out.attackerNationId, defenderId: out.defenderNationId, outcome: placed.aftermathOutcome, devastationScale: placed.devastationScale ?? 1,
    // A commanded battle with generals on the field: those whose guard fell are at risk (row 5).
    generalsStruck: out.mode === 'command' && Array.isArray(out.report?.tactical?.generalsFielded) && out.report.tactical.generalsFielded.length ? (out.report.tactical.generalsStruck || []) : null
  });
  s = { ...s, regions: aftermath.regions, nations: aftermath.nations, hiredCommanders: aftermath.hiredCommanders };

  // row 20: the city's damage
  if (o.kind === 'invasion' || o.kind === 'landing' || o.kind === 'defense') s = applyCityDamage(state, s, o.regionId, { cityDamage: out.cityDamage, razed: out.razed });
  // A Stone raid (stonePhase.js canAnnex): the winner before Chiefdoms takes SACK_INCOME_TURNS of the
  // city's gold (at least SACK_MIN_GOLD) from what its owner holds, never the city.
  let lootLog = null;
  if ((o.kind === 'invasion' || o.kind === 'landing' || o.kind === 'defense') && out.outcome === 'attacker' && !canAnnex(state, out.attackerNationId)) {
    const city = s.regions[o.regionId];
    const w = { playerId: s.playerNationId, resources: { ...s.resources }, nations: { ...s.nations } };
    const loot = Math.min(goldIn(w, out.defenderNationId), Math.max(SACK_MIN_GOLD, Math.round(SACK_INCOME_TURNS * (city?.lastYields?.gold || 0))));
    if (loot > 0) {
      addGoldIn(w, out.defenderNationId, -loot); addGoldIn(w, out.attackerNationId, loot);
      const victim = w.nations[out.defenderNationId];
      if (victim) w.nations[out.defenderNationId] = { ...victim, raidedBy: { ...(victim.raidedBy || {}), [out.attackerNationId]: state.turnNumber || 0 } }; // "Raided us" (opinion.js)
      s = { ...s, resources: w.resources, nations: w.nations };
      lootLog = { year: state.year, ...msg('m.battle.stoneLoot', { who: nameRef(s, out.attackerNationId), gold: loot, city: cityOr(s.regions, o.regionId) }), type: LogTypes.COMBAT };
    }
  }
  // A sack burns the town (raidBattle.js sackBurn) under the same 50% rule; never a capture.
  if (o.kind === 'sack') { const burn = sackCityDamage(state, out); if (burn) s = applyCityDamage(state, s, o.regionId, { cityDamage: burn }); }

  // row 13: survivors remember the battle; the ground keeps a mark for BATTLE_MARK_TURNS turns
  const fought = new Set([...out.attackerUnits, ...out.defenderUnits].map((u) => u.id));
  if (o.kind === 'landing' && o.navalUnitId) fought.add(o.navalUnitId);
  const units = { ...s.units };
  fought.forEach((uid) => { if (units[uid]) units[uid] = { ...units[uid], lastBattleTurn: state.turnNumber }; });
  // row 11: a battle at an infected city sends the plague home with its survivors
  const infected = (state.regions[o.regionId]?.plague?.i || 0) >= PLAGUE_CONTACT_I;
  if (infected && o.kind !== 'naval') fought.forEach((uid) => { if (units[uid] && units[uid].domain !== 'naval') units[uid] = { ...units[uid], plagueContact: { cityId: o.regionId, until: state.turnNumber + PLAGUE_CONTACT_TURNS } }; });
  s = { ...s, units };
  const name = o.name || battleNameOf(state, { kind: o.kind, regionId: o.regionId, tile: o.tile });
  if (placed.markTile != null && s.world) {
    const ts = s.world.tileState || {};
    const tileState = copyTileMap(ts);
    tileState[placed.markTile] = { ...(ts[placed.markTile] || {}), battle: { turn: state.turnNumber, until: (state.turnNumber || 0) + BATTLE_MARK_TURNS, outcome: out.outcome, name } };
    s = { ...s, world: { ...s.world, tileState } };
  }

  // row 15: each nation's battle record (research boosts read it)
  // A city taken again by the same nation soon after (conquest.js captureLog) is not a second prize (I132).
  s = { ...s, nations: recordStats(s.nations, out, placed.captured && !s.regions[o.regionId]?.conquest?.repeat) };
  // The winner's ruler earns renown (renown.js), once: this outcome is applied once by its id.
  const winnerId = out.outcome === 'attacker' ? out.attackerNationId : out.outcome === 'defender' ? out.defenderNationId : null;
  if (winnerId && s.nations[winnerId]?.ruler) {
    const [mine, theirs] = winnerId === out.attackerNationId ? [out.attackerUnits, out.defenderUnits] : [out.defenderUnits, out.attackerUnits];
    const men = (list) => list.reduce((x, u) => x + startStrength(state, out, u), 0);
    const cities = Object.values(s.regions).filter((c) => c.owner === winnerId).length;
    s = { ...s, nations: { ...s.nations, [winnerId]: grantBattleRenown(s.nations[winnerId], { outnumbered: men(mine) < men(theirs), cities, turn: state.turnNumber, where: name }) } };
  }
  // Decision 40: the player who took a city decides its fate on the capture card (capture.js), once.
  if (placed.captured && out.attackerNationId === viewerId && s.regions[o.regionId]?.owner === viewerId) s = openCapture(s, { opId: id, cityId: o.regionId, by: viewerId, from: state.regions[o.regionId]?.owner ?? null, source: 'battle' });
  // An independent remembers who attacked it (grudges.js, phase W2): any assault on its city, any
  // other battle in which it lost men.
  const lostMen = sum(out.defenderUnits) < out.defenderUnits.reduce((x, u) => x + startStrength(state, out, u), 0);
  if (isIndependentNation(s.nations[out.defenderNationId]) && (o.kind === 'invasion' || o.kind === 'landing' || lostMen)) s = { ...s, nations: addGrudge(s.nations, out.defenderNationId, out.attackerNationId, GRUDGE_ATTACKED, { id: o.kind === 'invasion' || o.kind === 'landing' ? 'attacked' : 'killed', turn: state.turnNumber }) };

  // row 14: the player's report, named, and the log
  const involved = viewerId === out.attackerNationId || viewerId === out.defenderNationId;
  let reportFields = {};
  let lossLine = '';
  if (involved) {
    const viewerState = state.playerNationId === viewerId ? state : { ...state, playerNationId: viewerId };
    reportFields = recordBattleReport(viewerState, {
      ...out.report, name, captured: placed.captured, outcome: out.outcome, kind: placed.reportKind || (o.kind === 'invasion' || o.kind === 'defense' ? out.report?.kind : o.kind),
      ...(placed.reportExtra || {}), ...(o.tile != null ? { tile: o.tile } : {}),
      fromRegionId: out.fromRegionId ?? null, targetRegionId: placed.aftermathRegionId ?? out.regionId ?? null,
      attackerNationId: out.attackerNationId, defenderNationId: out.defenderNationId, mode: out.mode,
      // The receipt (battleLedger.js): the operation, and the line the campaign logs for it.
      opId: id, line: placed.message, lineMsg: placed.msgKey ? sub(placed.msgKey, placed.msgVars) : null
    }, {
      attackers: out.attackerUnits, defenders: out.defenderUnits, beforeOf: (u) => startStrength(state, out, u), goneIds: goneAfter(state, out, placed.units),
      // The ledger against the map this outcome was committed to: a regiment the battle destroyed
      // never stands on the map, a survivor never regains strength (X04, I003).
      breaches: (rows) => checkLedger({ rows, before: state.units, after: s.units, missing: out.report?.tactical?.missingUnitIds })
    });
    // The Log reads the same ledger as the report and the result screen (X05: one count of men).
    const ledger = ledgerOf(reportFields.battleReports[0]);
    if (ledger.mine.fallen + ledger.theirs.fallen > 0) lossLine = sub('m.battle.fallenLine', { mine: menOf(ledger.mine.fallen), theirs: menOf(ledger.theirs.fallen) });
  }
  return {
    ...s,
    ...reportFields,
    rngSeed: out.rngSeed ?? s.rngSeed,
    logs: [...s.logs, { year: state.year, ...msg('m.battle.logLine', { battle: thing('battle', null, name), line: sub(placed.msgKey, placed.msgVars), loss: lossLine }), type: LogTypes.COMBAT }, ...(lootLog ? [lootLog] : []), ...aftermath.logs]
  };
};
