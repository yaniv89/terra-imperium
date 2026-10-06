// src/engine/battleOutcome.js
// The one battle outcome service (plans/MASTER-PLAN.md 6.7; RTS plan 9.1). Every battle path
// (a commanded real-time battle, the auto-resolve, a field battle, a sea battle, an invasion, a
// defence, a landing, the player's or an AI's) ends in ONE call:
//
//   applyBattleOutcome(state, outcome) -> state
//
// `outcome` is a BattleOutcome (makeBattleOutcome below): the operation id, the kind, the nations,
// where, the result, each side's campaign units after the battle (with how they left the field),
// and the commanded battle's extras (powers spent, the city's damage by manifest id, XP bonus).
// It is idempotent: an outcome whose id was already applied returns the state untouched
// (state.appliedBattleIds, the last APPLIED_MEMORY ids, an optional save field), so a result
// sent twice never pays twice. Command and Auto of the same operation share the id, so only one
// of them can ever land.
//
// Each row of master plan 6.7 is applied exactly once, in this order:
//   6  powers spent (applyPowers): missiles come out of the stockpile once; a nuclear strike's
//      condemnation, prestige loss and pariah mark as from the map
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
//   20 the city's damage by manifest id under the 50% rule (cityManifest.js), never building razing
//   13 lastBattleTurn on every survivor and the BATTLE_MARK_TURNS mark on the battle's tile
//   11 plague contact: survivors of a battle at an infected city carry it home (plague.js)
//   15 each nation's battle record (won, lost, cities taken), read by the research boosts
//   14 the player's battle report, named (battleName.js), and the log line
// The inputs rows (4, 7, 8, 9, 10, 11, 12, 16, 18, 19) live in battleInputs.js, and row 22 (the
// odds and the scouts' guess for the pre-battle screen) in battleOdds.js and intel.js. Pure.
import { LogTypes } from '../data/types';
import { awardXp } from '../data/promotions';
import { getGeneralXpMultiplier } from '../data/generals';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { NUCLEAR_GLOBAL_HOSTILITY, NUCLEAR_PRESTIGE_PENALTY, NUCLEAR_PARIAH_DURATION_TURNS, NUCLEAR_PARIAH_GOLD_MULT_PENALTY } from '../data/missiles';
import { getTiles } from '../data/geo/tiles';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { recordBattle } from './diplomacy';
import { conquerRegion } from './conquest';
import { applyBattleAftermath } from './aftermath';
import { recordBattleReport } from './battleReports';
import { addNationModifier } from './modifiers/timed';
import { clampPrestige } from './nationalPower';
import { cityManifestOf, applyCityBattleDamage } from './cityManifest';
import { hasMeleeUnitDeployed, isGarrisonBroken, resolveSiegeControlDamage, SIEGE_CONTROL_DAMAGE, SIEGE_CAPTURE_CONTROL_THRESHOLD } from './siege';
import { findTilePath, passableTile, placeInCity, regionForTile, unitTile, nearestHeldCity } from './armies';
import { isAir } from './airPower';
import { battleNameOf } from './battleName';
import { addGrudge } from './grudges';
import { isIndependentNation, GRUDGE_ATTACKED } from '../data/independents';
import { seaPassable, fleetAge, enemyFleetAt } from './fleets';
import { mapEffectsFor } from './techMapEffects';

export const OUTCOME_VERSION = 1;
export const APPLIED_MEMORY = 64;
export const XP_WIN = 30;
export const XP_LOSE = 15;
export const BATTLE_MARK_TURNS = 5;
export const PLAGUE_CONTACT_TURNS = 2;
export const PLAGUE_CONTACT_I = 0.02;
export const NAVAL_DEVASTATION_SCALE = 0.5;
export const MISSILE_POWER_TIERS = { missileTactical: 'tactical', missileTheatre: 'theatre', nuclearStrike: 'nuclear' };
export const OUTCOME_KINDS = ['invasion', 'landing', 'defense', 'field', 'naval', 'suppress', 'lane'];

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
    powersUsed: tactical.powersUsed || null,
    cityDamage: tactical.cityDamage || report.cityDamage || null,
    razed: tactical.razed || [],
    economy: tactical.economy || null,
    report
  };
};

// ---- row 6: powers spent once ---------------------------------------------------------------

/** Missiles fired inside a battle come out of the real stockpile; a nuclear strike costs as from the map. */
export const applyPowers = (state, o) => {
  let nations = state.nations;
  let regions = state.regions;
  const logs = [];
  [o.attackerNationId, o.defenderNationId].forEach((nationId, side) => {
    const used = o.powersUsed?.[side] || {};
    const nation = nations[nationId];
    if (!nation || !Object.keys(used).length) return;
    const missiles = { ...(nation.missiles || {}) };
    let nukes = 0;
    Object.entries(used).forEach(([id, n]) => {
      const tier = MISSILE_POWER_TIERS[id];
      if (!tier) return;
      const fired = Math.min(n, missiles[tier] || 0);
      missiles[tier] = (missiles[tier] || 0) - fired;
      if (tier === 'nuclear') nukes += fired;
    });
    nations = { ...nations, [nationId]: { ...nation, missiles } };
    if (nukes > 0) {
      const victimId = side === 0 ? o.defenderNationId : o.attackerNationId;
      Object.keys(nations).forEach((id) => {
        if (id === nationId) return;
        nations[id] = { ...nations[id], hostility: id === victimId ? 100 : Math.min(100, (nations[id].hostility || 0) + NUCLEAR_GLOBAL_HOSTILITY) };
      });
      const striker = nations[nationId];
      nations[nationId] = addNationModifier(
        { ...striker, prestige: clampPrestige((striker.prestige || 0) - NUCLEAR_PRESTIGE_PENALTY) },
        { sourceType: 'nuclear', sourceId: 'nuclear_pariah', label: 'Nuclear Pariah', mods: { 'national.goldMult': -NUCLEAR_PARIAH_GOLD_MULT_PENALTY }, duration: NUCLEAR_PARIAH_DURATION_TURNS, turnNumber: state.turnNumber }
      );
      if (o.regionId && regions[o.regionId]) regions = { ...regions, [o.regionId]: { ...regions[o.regionId], nuclearScarred: true } };
      logs.push({ year: state.year, message: `A nuclear strike devastates the battlefield at ${state.regions[o.regionId]?.name || 'the front'}. The world condemns the attack.`, type: LogTypes.COMBAT });
    }
  });
  if (nations === state.nations && regions === state.regions) return state;
  return { ...state, nations, regions, logs: [...state.logs, ...logs] };
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
  if (!o.isDefended) return { nextControl: region.control, captured: o.outcome === 'attacker' };
  if (o.pressure == null || (o.outcome === 'attacker' && garrisonBroken)) return resolveSiegeControlDamage({ currentControl: region.control, outcome: o.outcome, hasMeleeUnit, garrisonBroken });
  // An auto-resolved assault on a garrison (defense.js getAssaultPressure): the damage follows the exchange.
  const damaged = Math.max(0, (region.control || 0) - Math.round(SIEGE_CONTROL_DAMAGE.attacker * o.pressure));
  if (o.pressure <= 0 || damaged > SIEGE_CAPTURE_CONTROL_THRESHOLD) return { nextControl: damaged, captured: false };
  return hasMeleeUnit ? { nextControl: damaged, captured: true } : { nextControl: SIEGE_CAPTURE_CONTROL_THRESHOLD, captured: false };
};

const conquer = (s, regionId, conquerorId, war) => {
  const r = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, regionId, conquerorId, war);
  return { regions: r.regions, nations: r.nations, capitalTaken: r.capitalTaken };
};

const nameOf = (s, id) => (id === REBEL_OWNER_ID ? 'the rebels' : s.nations[id]?.name || id);

// An assault on a city from the land (the player's or an AI's invasion).
const invasionAdapter = (s, o, war, att, def) => {
  const target = s.regions[o.regionId];
  const siege = siegeOf(o, target);
  const captured = siege.captured || (o.decisive && o.outcome === 'attacker');
  const units = { ...s.units };
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { delete units[u.id]; return; }
    const stays = isAir(u); // aircraft fly home
    units[u.id] = { ...u, regionId: stays ? u.regionId : captured ? o.regionId : o.fromRegionId, tile: stays ? unitTile(s, u) : captured ? target.tile : unitTile(s, u), movesLeft: 0 };
  });
  def.forEach((u) => {
    if (!units[u.id]) return; // the militia and synthetic troops live on the battle only
    if (captured || u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = { ...u };
  });
  let { regions, nations } = s; let capitalTaken = false;
  if (captured) ({ regions, nations, capitalTaken } = conquer({ ...s, units }, o.regionId, o.attackerNationId, war));
  else if (o.isDefended) regions = { ...regions, [o.regionId]: { ...target, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: true } };
  const place = target.name || o.regionId;
  const me = o.attackerNationId === o.viewerId;
  const message = captured
    ? `${place} is conquered: taken from ${nameOf(s, target.owner)}${me ? ', it is now yours' : ` by ${nameOf(s, o.attackerNationId)}`}${capitalTaken ? ' (their capital has fallen!)' : ''}.${me ? ' Hold it: it starts restless (control 25%).' : ''}`
    : o.outcome === 'attacker' ? `${me ? 'Your forces' : nameOf(s, o.attackerNationId)} broke through at ${place} (control now ${siege.nextControl}%), but could not yet secure it.`
      : o.outcome === 'defender' ? `${me ? 'Your invasion' : `${nameOf(s, o.attackerNationId)}'s attack`} on ${place} was repelled.`
        : `The attack on ${place} ended in a mutual withdrawal.`;
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  return { units, regions, nations, captured, capitalTaken, message, score: winnerId ? { winnerId, share: captured ? 0.4 : 0.2 } : null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: target.tile };
};

// A landing from the sea: survivors go ashore only once the city is taken; else back aboard.
const landingAdapter = (s, o, war, att, def) => {
  const target = s.regions[o.regionId];
  const siege = siegeOf(o, target);
  const captured = siege.captured || (o.decisive && o.outcome === 'attacker');
  const units = { ...s.units };
  att.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = captured
      ? { ...u, regionId: o.regionId, tile: target.tile ?? null, embarkedOn: null, movesLeft: 0 }
      : { ...u, regionId: o.fromRegionId, embarkedOn: o.navalUnitId, movesLeft: 0 };
  });
  def.forEach((u) => {
    if (!units[u.id]) return;
    if (captured || u.strength <= 0) { delete units[u.id]; return; }
    units[u.id] = { ...u };
  });
  if (units[o.navalUnitId]) units[o.navalUnitId] = { ...units[o.navalUnitId], movesLeft: 0, lastBattleTurn: s.turnNumber };
  let { regions, nations } = s; let capitalTaken = false;
  if (captured) ({ regions, nations, capitalTaken } = conquer({ ...s, units }, o.regionId, o.attackerNationId, war));
  else if (o.isDefended) regions = { ...regions, [o.regionId]: { ...target, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: true } };
  const place = target.name || o.regionId;
  const me = o.attackerNationId === o.viewerId;
  const message = captured
    ? `${me ? 'Your amphibious assault' : `${nameOf(s, o.attackerNationId)}'s landing`} conquers ${place} from ${nameOf(s, target.owner)}${me ? ': it is now yours' : ''}${capitalTaken ? ' (their capital has fallen!)' : ''}.`
    : o.outcome === 'attacker' ? `${me ? 'Your landing' : `${nameOf(s, o.attackerNationId)}'s landing`} broke through at ${place} (control now ${siege.nextControl}%), but could not yet secure it.`
      : o.outcome === 'defender' ? `${me ? 'Your amphibious assault' : `${nameOf(s, o.attackerNationId)}'s landing`} on ${place} was repelled.`
        : `The landing at ${place} ended in a mutual withdrawal.`;
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  return { units, regions, nations, captured, capitalTaken, message, score: winnerId ? { winnerId, share: captured ? 0.4 : 0.2 } : null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: target.tile, reportKind: 'amphibious' };
};

// An assault on a city whose defender was asked first (defense.js): the queued defence record.
const defenseAdapter = (s, o, war, att, def, record) => {
  const region = s.regions[o.regionId];
  const siege = siegeOf(o, region);
  const captured = siege.captured || (o.decisive && o.outcome === 'attacker');
  const damaged = siege.nextControl < (region.control || 0);
  const pressure = o.pressure;
  const aggressorWon = pressure == null ? o.outcome === 'attacker' : pressure >= 0.5;
  const defenderWon = pressure == null ? o.outcome === 'defender' : pressure < 0.5;
  const units = { ...s.units };
  const fallback = captured ? nearestHeldCity(s, o.regionId, o.defenderNationId) : null;
  def.forEach((u) => {
    if (!units[u.id]) return;
    if (u.strength <= 0 || (captured && !fallback)) { delete units[u.id]; return; }
    const next = { ...units[u.id], strength: u.strength, morale: u.morale, xp: u.xp, rank: u.rank, promotions: u.promotions };
    units[u.id] = captured ? placeInCity(next, s.regions, fallback) : next;
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
  else regions = { ...regions, [o.regionId]: { ...region, control: siege.nextControl, lastAttackedTurn: s.turnNumber, underInvasion: damaged } };
  const name = region.name || o.regionId;
  const enemy = nameOf(s, o.attackerNationId);
  const mine = o.defenderNationId === o.viewerId;
  const message = captured
    ? `${enemy} storms ${name} and conquers it!${fallback ? ` ${mine ? 'Your' : 'The'} survivors fall back to ${s.regions[fallback]?.name || fallback}.` : ''}`
    : damaged ? `${enemy} presses the siege of ${name} (control now ${siege.nextControl}%). ${mine ? 'Your' : 'The'} garrison holds on.`
      : `${mine ? 'Your' : 'The'} garrison repels ${enemy}'s assault on ${name}!`;
  const winnerId = aggressorWon ? o.attackerNationId : defenderWon ? o.defenderNationId : null;
  return {
    units, regions, nations, captured, capitalTaken, message,
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
  const where = getTiles().names?.[o.tile] || s.regions[s.world?.tileOwner?.[o.tile]]?.name || 'the field';
  const mine = o.attackerNationId === o.viewerId;
  const enemy = nameOf(s, o.defenderNationId);
  const message = o.outcome === 'attacker' ? `${mine ? 'Your army' : nameOf(s, o.attackerNationId)} beat ${mine || o.defenderNationId !== o.viewerId ? enemy : 'your army'} in the field near ${where}${destroyed ? `, destroying ${destroyed} unit${destroyed > 1 ? 's' : ''} left on the field` : ''}.`
    : o.outcome === 'defender' ? `${mine ? 'Your attack' : `${nameOf(s, o.attackerNationId)}'s attack`} near ${where} was thrown back${o.defenderNationId === o.viewerId ? ' by your army' : ''}${destroyed ? `, ${destroyed} unit${destroyed > 1 ? 's' : ''} lost on the field` : ''}.`
      : `The battle near ${where} ended with both sides spent.`;
  return {
    units, regions: s.regions, nations: s.nations, captured: false, message, destroyed, fledBack,
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
  const where = s.regions[anchor]?.name ? `off ${s.regions[anchor].name}` : 'at sea';
  const mine = o.attackerNationId === o.viewerId;
  const who = mine ? 'Your fleet' : `${nameOf(s, o.attackerNationId)}'s fleet`;
  const message = o.outcome === 'attacker' ? `${who} beat ${mine || o.defenderNationId !== o.viewerId ? nameOf(s, o.defenderNationId) : 'your fleet'} ${where}${sunk ? `, sinking ${sunk} ship${sunk > 1 ? 's' : ''}` : ''}.`
    : o.outcome === 'defender' ? `${mine ? 'Your attack' : `${nameOf(s, o.attackerNationId)}'s attack`} ${where} was beaten off${o.defenderNationId === o.viewerId ? ' by your fleet' : ''}.`
      : `The sea battle ${where} ended with both fleets spent.`;
  return {
    units, regions: s.regions, nations: s.nations, captured: false, message, sunk,
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
  const name = region?.name || o.regionId;
  const message = o.outcome === 'attacker' ? `The rebellion in ${name} has been crushed.`
    : o.outcome === 'defender' ? `The garrison failed to suppress the rebellion in ${name}.` : `The fighting in ${name} ended without a clear result.`;
  return { units, regions, nations: s.nations, captured: false, message, score: null, aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, markTile: region?.tile ?? null, reportKind: 'rebellion' };
};

// Fleets contest the waters by a city (NAVAL_ENGAGEMENT, the region-level sea action): survivors
// hold their own positions, win or lose; there is no ground to take.
const laneAdapter = (s, o, war, att, def) => {
  const units = { ...s.units };
  att.forEach((u) => { if (!units[u.id]) return; if (u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u, movesLeft: 0 }; });
  def.forEach((u) => { if (!units[u.id]) return; if (u.strength <= 0) delete units[u.id]; else units[u.id] = { ...u }; });
  const attStart = sum(o.attackerStart); const defStart = sum(o.defenderStart);
  const winnerId = o.outcome === 'attacker' ? o.attackerNationId : o.outcome === 'defender' ? o.defenderNationId : null;
  const name = s.regions[o.regionId]?.name || o.regionId;
  const message = o.outcome === 'attacker' ? `The fleet cleared the enemy from the waters near ${name}.`
    : o.outcome === 'defender' ? `The fleet was driven off near ${name}.` : `The engagement near ${name} ended inconclusively.`;
  return {
    units, regions: s.regions, nations: s.nations, captured: false, message,
    score: winnerId ? { winnerId, share: o.outcome === 'attacker' ? (defStart ? (defStart - sum(o.defenderUnits)) / defStart : 0) : (attStart ? (attStart - sum(o.attackerUnits)) / attStart : 0) } : null,
    aftermathOutcome: o.outcome, aftermathRegionId: o.regionId, devastationScale: NAVAL_DEVASTATION_SCALE, markTile: null, reportKind: 'naval'
  };
};

const ADAPTERS = { invasion: invasionAdapter, landing: landingAdapter, defense: defenseAdapter, field: fieldAdapter, naval: navalAdapter, suppress: suppressAdapter, lane: laneAdapter };

// ---- row 20: the city's damage (manifest ids, the 50% rule) -----------------------------------

const applyRazedBuildings = (state, regionId, razed) => {
  const region = state.regions[regionId];
  const lost = [...new Set(razed || [])].filter((c) => (region?.buildings?.categories?.[c] ?? -1) >= 0);
  if (!lost.length) return state;
  const categories = { ...region.buildings.categories };
  lost.forEach((c) => { categories[c] -= 1; });
  const names = lost.map((c) => BUILDING_CATEGORIES[c]?.label || c).join(', ');
  return {
    ...state,
    regions: { ...state.regions, [regionId]: { ...region, buildings: { ...region.buildings, categories } } },
    logs: [...state.logs, { year: state.year, message: `The fighting left buildings in ${region.name || regionId} in ruins (${names}: one tier lost).`, type: LogTypes.COMBAT }]
  };
};

/** The battle's damage to the real city (cityManifest.js) on `after`, read against the manifest the battle loaded (`before`). */
export const applyCityDamage = (before, after, regionId, { cityDamage = null, razed = [] } = {}) => {
  if (!cityDamage) return razed?.length ? applyRazedBuildings(after, regionId, razed) : after;
  const manifest = cityManifestOf(before, regionId);
  if (!manifest || !after.regions[regionId]) return after;
  const occupation = before.regions[regionId]?.owner !== after.regions[regionId].owner;
  const burned = (razed || []).map((c) => `bld-${c}`);
  const { state: next, log } = applyCityBattleDamage(after, regionId, { destroyed: [...new Set([...(cityDamage.destroyed || []), ...burned])], damaged: cityDamage.damaged || [] }, { manifest, occupation });
  if (!log) return next;
  return { ...next, logs: [...next.logs, { year: next.year, message: `The fighting left its mark on ${after.regions[regionId]?.name || regionId}: ${log}.`, type: LogTypes.COMBAT }] };
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

  // row 6
  let s = applyPowers(base, out);
  // row 5 (XP), then the kind (rows 2, 3, 6.9)
  const att = awardSideXp(s, out, out.attackerUnits, out.deployedAttackerIds, xpFor('attacker', out.outcome));
  const def = awardSideXp(s, out, out.defenderUnits, out.deployedDefenderIds, xpFor('defender', out.outcome));
  const placed = ADAPTERS[o.kind](s, out, war, att, def, record);
  s = { ...s, units: placed.units, regions: placed.regions, nations: placed.nations };

  // row 1: one war-score entry
  if (placed.score && war) s = { ...s, wars: s.wars.map((w) => (w.id === war.id ? { ...w, battleScore: recordBattle(w, placed.score.winnerId, placed.score.share) } : w)) };

  // rows 5 and 21: the aftermath, every kind
  const beforeA = out.attackerUnits.map((u) => ({ ...(state.units[u.id] || u), strength: startStrength(state, out, u) }));
  const beforeD = out.defenderUnits.map((u) => ({ ...(state.units[u.id] || u), strength: startStrength(state, out, u) }));
  const aftermath = applyBattleAftermath(s, {
    regionId: placed.aftermathRegionId, beforeA, afterA: out.attackerUnits, beforeD, afterD: out.defenderUnits,
    attackerId: out.attackerNationId, defenderId: out.defenderNationId, outcome: placed.aftermathOutcome, devastationScale: placed.devastationScale ?? 1
  });
  s = { ...s, regions: aftermath.regions, nations: aftermath.nations, hiredCommanders: aftermath.hiredCommanders };

  // row 20: the city's damage
  if (o.kind === 'invasion' || o.kind === 'landing' || o.kind === 'defense') s = applyCityDamage(state, s, o.regionId, { cityDamage: out.cityDamage, razed: out.razed });

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
    s = { ...s, world: { ...s.world, tileState: { ...ts, [placed.markTile]: { ...(ts[placed.markTile] || {}), battle: { turn: state.turnNumber, until: (state.turnNumber || 0) + BATTLE_MARK_TURNS, outcome: out.outcome, name } } } } };
  }

  // row 15: each nation's battle record (research boosts read it)
  s = { ...s, nations: recordStats(s.nations, out, placed.captured) };
  // An independent remembers who attacked it (grudges.js, phase W2): any assault on its city, any
  // other battle in which it lost men.
  const lostMen = sum(out.defenderUnits) < out.defenderUnits.reduce((x, u) => x + startStrength(state, out, u), 0);
  if (isIndependentNation(s.nations[out.defenderNationId]) && (o.kind === 'invasion' || o.kind === 'landing' || lostMen)) s = { ...s, nations: addGrudge(s.nations, out.defenderNationId, out.attackerNationId, GRUDGE_ATTACKED, { id: o.kind === 'invasion' || o.kind === 'landing' ? 'attacked' : 'killed', turn: state.turnNumber }) };

  // row 14: the player's report, named, and the log
  const involved = viewerId === out.attackerNationId || viewerId === out.defenderNationId;
  let reportFields = {};
  if (involved) {
    const viewerState = state.playerNationId === viewerId ? state : { ...state, playerNationId: viewerId };
    reportFields = recordBattleReport(viewerState, {
      ...out.report, name, captured: placed.captured, outcome: out.outcome, kind: placed.reportKind || (o.kind === 'invasion' || o.kind === 'defense' ? out.report?.kind : o.kind),
      ...(placed.reportExtra || {}), ...(o.tile != null ? { tile: o.tile } : {}),
      fromRegionId: out.fromRegionId ?? null, targetRegionId: placed.aftermathRegionId ?? out.regionId ?? null,
      attackerNationId: out.attackerNationId, defenderNationId: out.defenderNationId, mode: out.mode
    }, { attackers: out.attackerUnits, defenders: out.defenderUnits, beforeOf: (u) => startStrength(state, out, u) });
  }
  return {
    ...s,
    ...reportFields,
    rngSeed: out.rngSeed ?? s.rngSeed,
    logs: [...s.logs, { year: state.year, message: `${name}: ${placed.message}`, type: LogTypes.COMBAT }, ...aftermath.logs]
  };
};
