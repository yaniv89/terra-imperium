// src/components/battle/warModel.js
// What the war screens (U1b: W11 Pre-battle, W14 You are attacked, B08 Result) say about a battle
// before it is fought, in one place so they agree (plans/UI-DESIGN.md section 3, master plan 6.1
// to 6.3 and 6.8). Pure: reads the state and the armies, changes nothing.
//   armyView      one side: men (strength on the map), regiments, lines by kind, generals
//   oddsSource    exact odds (a spy report, your own city, open ground in sight) or the scouts' guess
//   battleSize    300 a side: how many regiments fight at once on this ground, how many wait as waves
//   cityWallsView the walls (name, HP), the houses and the battle housing, and the 50% rule
import { unitDisplayName } from '../../data/unitNames';
import { getCombatWidth } from '../../data/combatWidth';
import { getCategoryTierName } from '../../data/buildings';
import { POP_LIMIT } from '../../battle/data/economy';
import { ECONOMY_FIELD_TICKS, ECONOMY_SIEGE_TICKS, TICK_HZ } from '../../battle/sim/constants';
import { wallsOf, siegeHpOf, siegeMaxHp } from '../../engine/sieges';
import { canSeeRegionDetails, hasIntel } from '../../engine/intel';
import { cityDefenseModel } from '../city/cityDefenseModel';

export const BATTLE_POP_LIMIT = POP_LIMIT;
/** Of a city's houses and buildings, at most this share carries to the map (master plan 6.8). */
export const CITY_DAMAGE_CARRY_MAX = 0.5;

const men = (u) => Math.max(0, Math.round(u.strength || 0));

/** One side of a battle as the war screens list it. `units` are macro units (militia flagged). */
export const armyView = (units = [], { ageId = 'bronze', hiredCommanders = {} } = {}) => {
  const by = new Map();
  units.forEach((u) => {
    const key = u.militia ? 'militia' : u.classId;
    const row = by.get(key) || { id: key, name: u.militia ? 'Militia' : unitDisplayName(ageId, u.classId, u.navalLine) || u.classId, regiments: 0, men: 0 };
    row.regiments += 1; row.men += men(u);
    by.set(key, row);
  });
  const generals = [...new Set(units.map((u) => u.commanderId).filter(Boolean))].map((id) => {
    const g = hiredCommanders[id];
    return { id, name: g?.name || 'A general', skill: g?.skill ?? null };
  });
  return {
    men: units.reduce((s, u) => s + men(u), 0),
    regiments: units.length,
    lines: [...by.values()].sort((a, b) => b.men - a.men),
    generals
  };
};

/** "Spearmen x2  160": the label of one line. */
export const lineLabel = (l) => (l.regiments > 1 ? `${l.name} x${l.regiments}` : l.name);

/**
 * Where the odds come from (rule 4: every number has a reason). Exact numbers only with a spy
 * report on the owner, against your own city (you defend it), or on open ground (both armies in
 * sight); otherwise the scouts' guess, a band and not a number.
 */
export const oddsSource = (state, { targetRegionId = null, field = false, defending = false } = {}) => {
  if (defending) return { exact: true, label: 'Your own city: you know both sides' };
  if (field) return { exact: true, label: 'Both armies in sight' };
  const owner = state.regions?.[targetRegionId]?.owner;
  if (owner && owner !== state.playerNationId && hasIntel(state, owner)) return { exact: true, label: 'Spy report' };
  if (canSeeRegionDetails(state, targetRegionId)) return { exact: true, label: 'In full sight' };
  return { exact: false, label: "Scouts' guess: a range, not a number. A spy report gives exact odds." };
};

/** A strength the scouts guess: plus or minus a fifth, rounded to tens ("about 260 to 320"). */
export const scoutsRange = (strength) => {
  const lo = Math.max(0, Math.round((strength * 0.8) / 10) * 10);
  const hi = Math.round((strength * 1.2) / 10) * 10;
  return { lo, hi, text: `about ${lo} to ${hi}` };
};

/** The battle's clock in minutes with the battle economy on (master plan 6.1, phase R1). */
export const battleMinutes = (kind) => Math.round((kind === 'assault' || kind === 'defense' || kind === 'invasion' || kind === 'amphibious' ? ECONOMY_SIEGE_TICKS : ECONOMY_FIELD_TICKS) / TICK_HZ / 60);

/**
 * 300 a side (master plan 6.2): every regiment brought enters (housing never blocks it), but only
 * as many fight at once as the ground allows; the rest wait off the map and come in as waves when
 * called. `regiments` is the player's side.
 */
export const battleSize = ({ regiments, terrain = 'mixed', kind = 'assault' }) => {
  const front = Math.min(regiments, getCombatWidth(terrain));
  const waves = Math.max(0, regiments - front);
  const minutes = battleMinutes(kind);
  return {
    cap: BATTLE_POP_LIMIT,
    front,
    waves,
    minutes,
    text: waves > 0
      ? `${front} regiments fight at once on this ground; ${waves} more wait off the map and join as a second wave.`
      : `All ${regiments} regiment${regiments === 1 ? '' : 's'} on the field at once.`
  };
};

/** The city's walls and houses for the pre-battle and attack screens, or null for open ground. */
export const cityWallsView = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return null;
  const level = wallsOf(city);
  const def = cityDefenseModel(state, cityId);
  const hp = siegeHpOf(city, state.greatProjects);
  const max = Math.max(1, siegeMaxHp(city, state.greatProjects));
  const houses = def?.lines.find((l) => l.id === 'houses');
  const houseCount = houses ? parseInt(houses.label, 10) || 0 : 0;
  return {
    level,
    name: level > 0 ? getCategoryTierName('defense', level - 1) || `Walls ${level}` : 'No walls',
    hpShare: hp / max,
    hpText: level > 0 ? `HP ${Math.round((hp / max) * 100)}%${city.siege ? ' after the siege so far' : ''}` : 'Open town',
    houses: houseCount,
    housing: def?.housing || 0,
    housingLines: def?.lines || [],
    maxLost: Math.floor(houseCount * CITY_DAMAGE_CARRY_MAX),
    ruleText: `At most half carries to the map: ${Math.floor(houseCount * CITY_DAMAGE_CARRY_MAX)} of ${houseCount} houses at worst.`
  };
};
