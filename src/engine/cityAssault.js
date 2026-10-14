// src/engine/cityAssault.js
// Auto against a city, Civilization style (the user's rule of 14 October). Two cases:
//
//   a garrison   units stand in the city: Auto fights those units first (autoBattle.js, the usual
//                auto-resolve with the city's militia, walls and auxiliaries beside them). Winning
//                damages or destroys them, and the beaten survivors are driven out to their nearest
//                city (lost with nowhere to go); the city is NOT taken (`report.garrisonFirst`,
//                battleOutcome.js beatenGarrison). A lost fight leaves them in place.
//   empty city   no unit of the owner stands in it: the attack is against the city itself, here.
//
// The attack on an empty city, in plain words:
//   attack    the attackers' strength: every land unit's strength, siege engines count
//             SIEGE_VS_CITY (x SIEGE_ENGINEERING_MULT with Siege Engineering), cavalry CAVALRY_VS_CITY
//             (horses are poor at walls), aircraft AIR_VS_CITY; times the age gap of the two rosters
//             (a newer army hits harder)
//   defence   the city's own strength: (CITY_DEF_BASE + CITY_DEF_PER_SIZE x size), raised by the
//             walls (CITY_DEF_PER_WALL a wall level, Palisade 1 to Star Fort 3, sieges.js wallsOf),
//             whose effect fades to half as the walls' HP is battered down, plus the city's militia
//             (battleInputs.js: its houses and town hall)
//   damage    CITY_HIT_HP x (attack / defence)^CITY_HIT_EXP HP off the city's HP (sieges.js
//             siegeMaxHp: walls, size and a fortress wonder), the ratio held between MIN_RATIO and
//             MAX_RATIO, x a roll of 0.85 to 1.15
//   falls     the city is taken when this attack brings its HP to 0 (and the attackers have foot or
//             horse to hold it, the melee rule in battleOutcome.js). A siege alone never takes it.
//   cost      the city strikes back: the attackers lose CITY_STRIKE x defence men, at most
//             CITY_STRIKE_CAP of their own strength, shared out by strength; the militia lose the
//             share of HP the attack took (all of it when the city falls)
// Numbers: a Bronze city of size 3 behind a Palisade (520 HP, defence about 1,500) takes 3 or 4
// attacks from a normal army of four regiments; an unwalled size-2 town (240 HP, defence about 850)
// falls to one attack of four regiments or more. A siege first (HP down, walls battered) cuts that.
// The HP lives on the city's siege record (city.siege.hp), so it heals SIEGE_HEAL a turn once nobody
// besieges or attacks it (sieges.js). Pure; the roll comes from the battle's rng.
import { siegeHpOf, siegeMaxHp, wallsOf, SIEGE_ENGINEERING_TECH, SIEGE_ENGINEERING_MULT } from './sieges';
import { getRosterCombatMultiplier } from '../data/unitClasses';
import { getResearched } from './nationState';

export const CITY_DEF_BASE = 500;
export const CITY_DEF_PER_SIZE = 150;
export const CITY_DEF_PER_WALL = 0.5;
export const CITY_HIT_HP = 75;
export const CITY_HIT_EXP = 0.75;
export const MIN_RATIO = 0.25;
export const MAX_RATIO = 6;
export const SIEGE_VS_CITY = 2;
export const CAVALRY_VS_CITY = 0.6;
export const AIR_VS_CITY = 0.5;
export const CITY_STRIKE = 0.2;
export const CITY_STRIKE_CAP = 0.4;
export const CITY_ROLL_SPREAD = 0.3; // the roll is 1 - spread/2 to 1 + spread/2

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const alive = (list) => (list || []).filter((u) => u && u.strength > 0);

/** Units standing in the city that Auto must fight first: the owner's land units (not militia, not aircraft). */
export const garrisonOf = (defenderUnits) => alive(defenderUnits).filter((u) => !u.militia && !u.auxiliary && u.domain !== 'naval' && u.classId !== 'air' && u.classId !== 'settler');

/** The attackers' strength against a city (see the header). */
export const cityAttackStrength = (attackerUnits, { siegeEngineering = false, attackerAgeId = 'bronze', defenderAgeId = 'bronze' } = {}) => {
  const raw = alive(attackerUnits).reduce((s, u) => {
    const f = u.classId === 'siege' ? SIEGE_VS_CITY * (siegeEngineering ? SIEGE_ENGINEERING_MULT : 1)
      : u.classId === 'cavalry' ? CAVALRY_VS_CITY : u.classId === 'air' ? AIR_VS_CITY : 1;
    return s + u.strength * f;
  }, 0);
  return raw * getRosterCombatMultiplier(attackerAgeId || 'bronze', defenderAgeId || 'bronze');
};

/** The city's own defence (see the header). `hpRatio`: the walls' HP share left, 0..1. */
export const cityDefence = (city, { militia = [], hpRatio = 1 } = {}) => {
  const base = CITY_DEF_BASE + CITY_DEF_PER_SIZE * (city?.size || 1);
  const walls = wallsOf(city || {}) * CITY_DEF_PER_WALL * (0.5 + 0.5 * clamp(hpRatio, 0, 1));
  return base * (1 + walls) + alive(militia).reduce((s, u) => s + u.strength, 0);
};

/** The HP one attack takes off the city, before the roll. */
export const cityAttackDamage = (attack, defence) => CITY_HIT_HP * Math.pow(clamp(defence > 0 ? attack / defence : MAX_RATIO, MIN_RATIO, MAX_RATIO), CITY_HIT_EXP);

/**
 * One Auto attack on an empty city. `args`: resolveBattle's arguments (attackerUnits, ages);
 * `ins`: battleInputs (the conditioned attackers, the militia, hpRatio). Returns a resolveBattle-
 * shaped result: { outcome, attackerUnits, defenderUnits (the militia), report: { cityAttack } }.
 */
export const resolveCityAttack = (state, args, ins, cityId, rng) => {
  const city = state.regions[cityId];
  const maxHp = siegeMaxHp(city, state.greatProjects);
  const hpBefore = Math.min(maxHp, siegeHpOf(city, state.greatProjects));
  const attackerNationId = ins.attackerUnits[0]?.ownerId ?? null;
  const siegeEngineering = !!attackerNationId && getResearched(state, attackerNationId).includes(SIEGE_ENGINEERING_TECH);
  const attack = cityAttackStrength(ins.attackerUnits, { siegeEngineering, attackerAgeId: args.attackerAgeId, defenderAgeId: args.defenderAgeId });
  const defence = cityDefence(city, { militia: ins.militia, hpRatio: ins.hpRatio });
  const roll = 1 - CITY_ROLL_SPREAD / 2 + CITY_ROLL_SPREAD * rng.next();
  const damage = Math.max(1, Math.round(cityAttackDamage(attack, defence) * roll));
  const hpAfter = Math.max(0, hpBefore - damage);
  const falls = hpAfter <= 0;
  // The city strikes back: losses shared by strength over the attacking land units.
  const fighters = alive(ins.attackerUnits).filter((u) => u.classId !== 'air');
  const own = fighters.reduce((s, u) => s + u.strength, 0);
  const loss = Math.min(Math.round(CITY_STRIKE_CAP * own), Math.round(CITY_STRIKE * defence));
  let left = loss;
  const attackerUnits = ins.attackerUnits.map((u, i) => {
    if (!(u.strength > 0) || u.classId === 'air' || own <= 0) return { ...u };
    const share = i === ins.attackerUnits.length - 1 ? left : Math.min(left, Math.round(loss * u.strength / own));
    left -= share;
    return { ...u, strength: Math.max(0, u.strength - share) };
  });
  // Any rounding rest falls on the strongest unit.
  if (left > 0) { const top = attackerUnits.filter((u) => u.strength > 0 && u.classId !== 'air').sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1))[0]; if (top) top.strength = Math.max(0, top.strength - left); }
  const taken = falls ? 1 : clamp(hpBefore > 0 ? damage / hpBefore : 1, 0, 1);
  const defenderUnits = (ins.defenderUnits || []).map((u) => ({ ...u, strength: Math.max(0, Math.round(u.strength * (1 - taken))) }));
  const outcome = falls || attack >= defence ? 'attacker' : 'defender';
  const cityAttack = { hpBefore, hpAfter, maxHp, damage, attack: Math.round(attack), defence: Math.round(defence), falls, walls: wallsOf(city) };
  return {
    outcome,
    attackerUnits,
    defenderUnits,
    rounds: 1,
    report: { log: [], deployedAttackerIds: attackerUnits.map((u) => u.id), deployedDefenderIds: defenderUnits.map((u) => u.id), outcome, cityAttack, mode: 'auto' },
    inputs: ins
  };
};

/** Attacks an army of `attack` strength needs to bring a full-HP city to 0 (no roll, no siege): for the pre-battle card. */
export const attacksToTake = (state, city, attack, militia = []) => {
  const per = cityAttackDamage(attack, cityDefence(city, { militia, hpRatio: 1 }));
  return per > 0 ? Math.ceil(siegeHpOf(city, state.greatProjects) / per) : Infinity;
};
