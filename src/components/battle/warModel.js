// src/components/battle/warModel.js
// What the war screens (U1b: W11 Pre-battle, W14 You are attacked, B08 Result) say about a battle
// before it is fought, in one place so they agree (plans/UI-DESIGN.md section 3, master plan 6.1
// to 6.3 and 6.8). Pure: reads the state and the armies, changes nothing.
//   armyView      one side: men (strength on the map), regiments, lines by kind, generals
//   oddsSource    exact odds (a spy report, your own city, open ground in sight) or the scouts' guess
//   battleSize    300 a side: the whole army takes the field at once (U10, no Reserve and no waves)
//   cityWallsView the walls (name, HP), the houses and the battle housing
import { menOf, countText } from '../../engine/battleLedger';
import { unitDisplayName } from '../../data/unitNames';
import { getCategoryTierName } from '../../data/buildings';
import { POP_LIMIT, trainableRoles, ecoName } from '../../battle/data/economy';
import { ECONOMY_FIELD_TICKS, ECONOMY_SIEGE_TICKS, TICK_HZ } from '../../battle/sim/constants';
import { wallsOf, siegeHpOf, siegeMaxHp } from '../../engine/sieges';
import { canSeeRegionDetails, hasIntel } from '../../engine/intel';
import { cityDefenseModel } from '../city/cityDefenseModel';

export const BATTLE_POP_LIMIT = POP_LIMIT;

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

/** A strength the scouts guess, in men: plus or minus a fifth, rounded to tens ("about 2,600 to 3,200"). */
export const scoutsRange = (strength) => {
  const m = menOf(strength);
  const lo = Math.max(0, Math.round((m * 0.8) / 10) * 10);
  const hi = Math.round((m * 1.2) / 10) * 10;
  return { lo, hi, text: `about ${countText(lo)} to ${countText(hi)}` };
};

/** The battle's clock in minutes with the battle economy on (master plan 6.1, phase R1). */
export const battleMinutes = (kind) => Math.round((kind === 'assault' || kind === 'defense' || kind === 'invasion' || kind === 'amphibious' ? ECONOMY_SIEGE_TICKS : ECONOMY_FIELD_TICKS) / TICK_HZ / 60);

/**
 * 300 a side (master plan 6.2): every regiment brought enters (housing never blocks it), but only
 * as many fight at once as the ground allows; the rest wait off the map and come in as waves when
 * called. `regiments` is the player's side.
 */
// `terrain` no longer limits it (the combat width was the old Reserve rule); past the 300-a-side
// cap, a guard only (sim/world.js MAX_START_SQUADS), the weakest regiments stay out untouched.
export const battleSize = ({ regiments, kind = 'assault' }) => {
  const front = Math.min(regiments, BATTLE_POP_LIMIT);
  const heldBack = Math.max(0, regiments - front);
  const minutes = battleMinutes(kind);
  return {
    cap: BATTLE_POP_LIMIT,
    front,
    heldBack,
    minutes,
    text: heldBack > 0
      ? `The strongest ${front} regiments take the field; ${heldBack} more stay out of this battle.`
      : `All ${regiments} regiment${regiments === 1 ? '' : 's'} on the field at once.`
  };
};

/**
 * The one name every screen gives a city's walls (playtest audit I009: the army sheet said "2
 * walls", the independent's card "walls strong" and the pre-battle card the building's name for
 * the same city). The wall level is the fortification; the siege's HP is the city's endurance, which
 * an open town has too, so it is never called its walls.
 */
export const wallsLabel = (city) => {
  const level = city ? wallsOf(city) : 0;
  return level > 0 ? getCategoryTierName('defense', level - 1) || `Walls ${level}` : 'No walls';
};

/**
 * I213: the pre-battle warning to bring siege tools. A walled city against an army without a
 * siege engine: the gate holds it out and its blows on the walls count for little. Names the age's
 * siege regiment (if the age has one) and the battle's siege workshop (it can train them on the
 * field). Null when there is nothing to warn about.
 */
export const siegeAdvice = ({ wallLevel = 0, units = [], ageId = 'bronze' }) => {
  if (!(wallLevel > 0) || units.some((u) => u.classId === 'siege' && u.strength > 0)) return null;
  if (!trainableRoles(ageId).includes('siege')) return 'Walls and no siege engines in your age: expect a long fight at the gate.';
  return `Walls: without siege engines your army can only batter the gate. Bring ${unitDisplayName(ageId, 'siege') || 'siege engines'}, or build a ${ecoName('siegeWorkshop', ageId).toLowerCase()} in the battle to train them.`;
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
    name: wallsLabel(city),
    hpShare: hp / max,
    hpText: level > 0 ? `HP ${Math.round((hp / max) * 100)}%${city.siege ? ' after the siege so far' : ''}` : 'Open town',
    houses: houseCount,
    housing: def?.housing || 0,
    housingLines: def?.lines || []
  };
};
