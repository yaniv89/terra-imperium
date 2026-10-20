// src/data/cityStates.js
// City-state types and their patron bonus (decision 42, X25; Civ style). Pure data and small pure
// functions, no engine imports (like src/data/independents.js, which it builds on).
//
// Every independent city has a TYPE, read from its personality (independents.js personalityFor)
// and never saved: a raiders people stays Raiders (it raids, no bonus); a mercantile city is Trade,
// a fortress Military, and a tribal city Science or Culture by a fixed roll of its id. At most a
// third of a new world's city-states are raiders (RAIDER_SHARE_MAX; the rest become tribal).
//
// The PATRON of a city-state is the major it favours: on its think turns it looks at the majors
// that have met it with a city within PATRON_KM and takes the one it likes best (attitude, the
// joining measure of indepPolicy.js), if that attitude is at least PATRON_OPINION. The patron gets
// the type's bonus every turn while it lasts:
//   Trade     +patronGoldOf(age) gold (2 in the Bronze Age, +1 an age)
//   Military  +patronManpowerOf(age) manpower
//   Science   +patronScienceOf(age) research points
//   Culture   +PATRON_PRESTIGE prestige (prestige fades 5% a turn, rounded down, so it settles near 40)
// A gift (GIFT_GOLD) raises the attitude by its favour, so the player can buy a patronage.
import { AGE_ORDER, FIRST_AGE_ID } from './ages';

export const CITY_STATE_TYPE_IDS = ['trade', 'military', 'science', 'culture', 'raiders'];
export const CITY_STATE_TYPES = {
  trade: { id: 'trade', name: 'Trade', badge: '#ca8a04', bonus: 'gold', icon: 'coins' },
  military: { id: 'military', name: 'Military', badge: '#57534e', bonus: 'manpower', icon: 'shield' },
  science: { id: 'science', name: 'Science', badge: '#2563eb', bonus: 'research', icon: 'flask' },
  culture: { id: 'culture', name: 'Culture', badge: '#9333ea', bonus: 'prestige', icon: 'landmark' },
  raiders: { id: 'raiders', name: 'Raiders', badge: '#c2410c', bonus: null, icon: 'swords' }
};

/** At most this share of a new world's city-states are raiders. */
export const RAIDER_SHARE_MAX = 1 / 3;

/** A patron needs a city within this distance and at least this attitude. */
export const PATRON_KM = 1224;
export const PATRON_OPINION = 30;
export const PATRON_PRESTIGE = 2;

const rank = (ageId) => Math.max(0, AGE_ORDER.indexOf(ageId));
export const patronGoldOf = (ageId = FIRST_AGE_ID) => 2 + rank(ageId);
export const patronManpowerOf = (ageId = FIRST_AGE_ID) => 3 + 2 * rank(ageId);
export const patronScienceOf = (ageId = FIRST_AGE_ID) => 1 + rank(ageId);

// Deterministic 0..1 from a string (FNV-1a), the same roll as independents.js.
const roll = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};
export const cityStateRoll = roll;

/** The type of an independent's nation record (null for a major). */
export const cityStateTypeOf = (nation) => {
  if (nation?.kind !== 'independent') return null;
  const p = nation.indep?.personality || 'tribal';
  if (p === 'raiders') return 'raiders';
  if (p === 'mercantile') return 'trade';
  if (p === 'fortress') return 'military';
  return roll(`${nation.id}|cityStateType`) < 0.5 ? 'science' : 'culture';
};

/** The bonus a patron of this type gets a turn: { gold, hr, techPoints, prestige } (zeros left out). */
export const patronBonusOf = (type, ageId = FIRST_AGE_ID) => {
  if (type === 'trade') return { gold: patronGoldOf(ageId) };
  if (type === 'military') return { hr: patronManpowerOf(ageId) };
  if (type === 'science') return { techPoints: patronScienceOf(ageId) };
  if (type === 'culture') return { prestige: PATRON_PRESTIGE };
  return {};
};

/** "+3 gold a turn" (null for raiders). */
export const patronBonusText = (type, ageId = FIRST_AGE_ID) => {
  const b = patronBonusOf(type, ageId);
  if (b.gold) return `+${b.gold} gold a turn`;
  if (b.hr) return `+${b.hr} manpower a turn`;
  if (b.techPoints) return `+${b.techPoints} research a turn`;
  if (b.prestige) return `+${b.prestige} prestige a turn`;
  return null;
};

/** The raider cap of a new world: `personalities` { id: personality } -> the same with at most
 * round(n x RAIDER_SHARE_MAX) raiders (the extras, by a fixed roll of their ids, become tribal). */
export const capRaiders = (personalities) => {
  const ids = Object.keys(personalities).sort();
  const raiders = ids.filter((id) => personalities[id] === 'raiders');
  const keep = Math.round(ids.length * RAIDER_SHARE_MAX);
  if (raiders.length <= keep) return personalities;
  const out = { ...personalities };
  raiders.map((id) => ({ id, r: roll(`${id}|raiderCap`) })).sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : 1))
    .slice(keep).forEach(({ id }) => { out[id] = 'tribal'; });
  return out;
};

