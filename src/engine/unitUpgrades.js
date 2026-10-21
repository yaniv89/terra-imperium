// src/engine/unitUpgrades.js
// Units keep the age they were built in (the user's rule of 21 October): a Spearman stays a
// Spearman when its nation reaches the Classical age, with the Spearman's name, model and roster
// strength, until its owner pays to upgrade it. Cities only ever build the current age's unit.
//
//   unit.ageId     stamped when the unit is made (or, for a major's unit without one, at the start
//                  of the turn and on load: stampUnitAges). A unit without it fights at its side's
//                  age, so independents, rebels and test fixtures are unchanged.
//   strength       battle.js computeHitMultiplier weighs each unit by unitAgeWeight (its roster
//                  attack over its side's), so a mixed army fights with each unit's own age.
//   upgrade        UPGRADE_UNIT turns an older unit into the current age's unit of its class, keeping
//                  its men, morale, experience and promotions. Only on a tile its nation owns, not
//                  embarked, not committed to a battle, not in a city under siege, and only when the
//                  new unit's tech is known (UNIT_UNLOCKS).
//   price          the production the new unit costs over the old one, bought at the rush price:
//                    hammers = max(cost(new age) - cost(old age), ceil(UPGRADE_MIN_SHARE x cost(new age)))
//                    gold    = rushGold(hammers)          (RUSH_GOLD_PER_HAMMER gold a point, no heat)
//                  both costs at the payer's training speed (speedTrainMult of the new age), so the
//                  price follows the game speed like a rush does. Two ages with the same cost curve
//                  (Stone and Bronze) still cost the floor share.
//   AI             aiUpgradeUnits: a major with gold over AI_UPGRADE_RESERVE upgrades up to
//                  AI_MAX_UPGRADES_PER_THINK units at home on its think turns, oldest first.
// Ripples: battle strength (battle.js, the tactical sim's squad stats and models), the treasury
// (a gold sink), the army sheet (names, models, the button), the AI's spending.
import { AGES, getAgeIndex, isAgeBefore, speedTrainMult } from '../data/ages';
import { UNIT_ROSTER, isUnitUnlocked, unitUnlockTech } from '../data/unitClasses';
import { isIndependentNation } from '../data/independents';
import { navalCargo, navalLinesFor } from '../data/navalLines';
import { TECH_TREE } from '../data/techTree';
import { ageOf, getResearched } from './nationState';
import { sideAgeOf } from './ageRefs';
import { productionCost } from './world/cities';
import { rushGold } from './spending';
import { isUnitInBattle } from './invasion';
import { reasonOf, thing } from './messages';

export const UPGRADE_MIN_SHARE = 0.25;
export const AI_UPGRADE_RESERVE = 400;
export const AI_MAX_UPGRADES_PER_THINK = 2;

const isMajor = (state, id) => id != null && (id === state.playerNationId || (!!state.nations?.[id] && !isIndependentNation(state.nations[id])));

/** The age a unit fights, is named and drawn at: its own, else its side's (an independent's floats). */
export const unitAgeOf = (state, unit) => (AGES[unit?.ageId] ? unit.ageId : sideAgeOf(state, unit?.ownerId));

/** Every major's unit without an age gets its owner's age now. Same state when nothing changed. */
export const stampUnitAges = (state) => {
  let units = null;
  for (const id in state.units || {}) {
    const u = state.units[id];
    if (u.ageId || !isMajor(state, u.ownerId)) continue;
    units ||= { ...state.units };
    units[id] = { ...u, ageId: ageOf(state, u.ownerId) };
  }
  return units ? { ...state, units } : state;
};

/** Gold to upgrade a `classId` unit from `fromAge` to `toAge` at `gameSpeed` (see the header). */
export const upgradeGold = (classId, fromAge, toAge, gameSpeed) => {
  const trainMult = speedTrainMult(gameSpeed, toAge);
  const cost = (ageId) => productionCost({ kind: 'unit', classId }, { ageId, trainMult });
  const next = cost(toAge);
  return rushGold(Math.max(next - cost(fromAge), Math.ceil(next * UPGRADE_MIN_SHARE)));
};

const treasuryOf = (state, id) => (id === state.playerNationId ? state.resources?.gold : state.nations?.[id]?.economy?.gold) || 0;

/**
 * Can `unitId` be upgraded now? { ok, older, gold, fromAge, toAge, reason, reasonMsg }. `older` is
 * false for a unit already of its owner's age (nothing to show). `treasury` overrides the gold check.
 */
export const upgradeQuote = (state, unitId, treasury = null) => {
  const u = state.units?.[unitId];
  if (!u || !isMajor(state, u.ownerId) || u.explorer || u.classId === 'settler') return { ok: false, older: false };
  const fromAge = unitAgeOf(state, u);
  const toAge = ageOf(state, u.ownerId);
  if (!isAgeBefore(fromAge, toAge) || !UNIT_ROSTER[toAge]?.[u.classId]) return { ok: false, older: false };
  const gold = upgradeGold(u.classId, fromAge, toAge, state.gameSpeed);
  const base = { ok: false, older: true, gold, fromAge, toAge };
  const tech = unitUnlockTech(toAge, u.classId);
  if (!isUnitUnlocked(toAge, u.classId, getResearched(state, u.ownerId))) return { ...base, ...reasonOf('m.why.upgradeNeedsTech', { tech: thing('tech', tech, TECH_TREE[tech]?.name || tech) }) };
  if (u.classId === 'naval' && u.navalLine && !navalLinesFor(toAge).includes(u.navalLine)) return { ...base, ...reasonOf('m.why.notThisAge') };
  const city = state.regions?.[u.regionId];
  const tile = u.embarkedOn ? null : u.tile ?? city?.tile;
  // tileOwner holds the owning city's id
  if (tile == null || state.regions?.[state.world?.tileOwner?.[tile]]?.owner !== u.ownerId) return { ...base, ...reasonOf('m.why.upgradeOwnLand') };
  if (u.siegeOf || (city?.tile === tile && city.siege?.by) || isUnitInBattle(state, u.id)) return { ...base, ...reasonOf('m.why.upgradeInBattle') };
  if ((treasury ?? treasuryOf(state, u.ownerId)) < gold) return { ...base, ...reasonOf('m.why.upgradeGold', { gold }) };
  return { ...base, ok: true };
};

/** The unit as the current age's unit of its class: same men, morale, experience and promotions. */
export const upgradedUnit = (u, toAge) => ({ ...u, ageId: toAge, ...(u.classId === 'naval' ? { transportCapacity: navalCargo(u.navalLine || 'warship', toAge) } : {}) });

/**
 * Upgrade every unit of `unitIds` that can be, in order, while the gold lasts:
 * { units (a new map, or the same one), gold (spent), count, first (the first refusal's quote) }.
 */
export const upgradeUnits = (state, unitIds, treasury = treasuryOf(state, state.units?.[unitIds[0]]?.ownerId)) => {
  let units = state.units; let gold = 0; let count = 0; let first = null;
  for (const id of new Set(unitIds)) { // a repeated id is one upgrade, charged once
    const q = upgradeQuote(state, id, treasury - gold);
    if (!q.ok) { if (q.older && !first) first = q; continue; }
    if (units === state.units) units = { ...units };
    units[id] = upgradedUnit(units[id], q.toAge);
    gold += q.gold; count += 1;
  }
  return { units, gold, count, first };
};

/**
 * The AI's upgrades on a think turn (resolveTurn's AI economy phase): up to AI_MAX_UPGRADES_PER_THINK
 * of `owned` (the nation's units), oldest age first, while its gold stays over AI_UPGRADE_RESERVE.
 * `gold`: its treasury now. Writes into the turn's working `units` map; returns the gold spent.
 */
export const aiUpgradeUnits = (state, nationId, owned, units, gold) => {
  const now = ageOf(state, nationId);
  const old = owned.filter((u) => u.ageId && isAgeBefore(u.ageId, now));
  if (!old.length) return 0;
  old.sort((a, b) => getAgeIndex(a.ageId) - getAgeIndex(b.ageId) || (a.id < b.id ? -1 : 1));
  let left = gold - AI_UPGRADE_RESERVE;
  let spent = 0; let done = 0;
  for (const u of old) {
    if (done >= AI_MAX_UPGRADES_PER_THINK || left <= 0) break;
    const q = upgradeQuote(state, u.id, left);
    if (!q.ok) continue;
    units[u.id] = upgradedUnit(units[u.id] || u, q.toAge);
    left -= q.gold; spent += q.gold; done += 1;
  }
  return spent;
};
