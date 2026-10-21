// src/engine/renown.js
// Renown, the ruler's one currency (plans/RULER-PLAN.md 4.1 and 4.5, differentiation plan U11).
// A lifetime total on nation.ruler.renown, earned where each deed happens (src/data/rulers.js
// RENOWN: cities founded and taken, battles and wars won, techs, wonders, era goals, years of order)
// and a trickle of RENOWN.timePerRefTurn a reference turn while the capital is held. Never lost,
// except that a lost civil war empties the progress toward the next level (humbleRuler).
//   grant    amount x CATCHUP_MULT while the ruler is a "rising star" (below the median level of the
//            living majors, set once a turn by the rulers phase), rounded to 0.1
//   damping  conquest and battle renown x SIZE_DAMP_CITIES / max(SIZE_DAMP_CITIES, cities owned)
//   battles  at most BATTLE_RENOWN_TURN_CAP a turn (ruler.battleRenown = { turn, n })
// The last RENOWN_DEEDS_KEPT grants stay on ruler.deeds for the "why" list. Pure: a nation without a
// ruler (an independent) comes back unchanged; nothing else writes ruler.renown.
import {
  RENOWN, RENOWN_DEEDS_KEPT, SIZE_DAMP_CITIES, BATTLE_RENOWN_TURN_CAP, CATCHUP_MULT, renownForLevel,
  ERA_LEGACY_VIRTUE_MAX, rulerLevel, TIME_RENOWN_REF_TURNS
} from '../data/rulers';
import { speedCostMult, speedTurns } from '../data/ages';

const r1 = (x) => Math.round(x * 10) / 10;

/** Adds `amount` renown for `deed` (a RENOWN_DEED_LABELS key); `where` names the place or thing. */
export const grantRenown = (nation, deed, amount, turn, where = null) => {
  const ruler = nation?.ruler;
  if (!ruler || !(amount > 0)) return nation;
  const n = r1(amount * (ruler.risingStar ? CATCHUP_MULT : 1));
  const deeds = deed === 'time' ? ruler.deeds : [{ turn, id: deed, renown: n, ...(where != null ? { where } : {}) }, ...(ruler.deeds || [])].slice(0, RENOWN_DEEDS_KEPT);
  return { ...nation, ruler: { ...ruler, renown: r1((ruler.renown || 0) + n), deeds } };
};

/** The size damping of conquest and battle renown for a nation with `cities` cities. */
export const sizeDamp = (cities) => SIZE_DAMP_CITIES / Math.max(SIZE_DAMP_CITIES, cities || 0);

/** Renown for a battle won, damped and capped at BATTLE_RENOWN_TURN_CAP a turn. */
export const grantBattleRenown = (nation, { outnumbered = false, cities = 1, turn, where = null }) => {
  const ruler = nation?.ruler;
  if (!ruler) return nation;
  const so = ruler.battleRenown?.turn === turn ? ruler.battleRenown.n : 0;
  const amount = Math.min(BATTLE_RENOWN_TURN_CAP - so, (RENOWN.battleWon + (outnumbered ? RENOWN.battleOutnumbered : 0)) * sizeDamp(cities));
  if (amount <= 0) return nation;
  const next = grantRenown(nation, 'battleWon', amount, turn, where);
  return { ...next, ruler: { ...next.ruler, battleRenown: { turn, n: so + amount } } };
};

/** Renown for a city taken: from a major (its capital more), or from an independent. */
export const cityTakenRenown = ({ fromIndependent = false, capital = false, cities = 1 }) =>
  (fromIndependent ? RENOWN.cityTakenIndep : RENOWN.cityTaken + (capital ? RENOWN.capitalTaken : 0)) * sizeDamp(cities);

/** Renown for a tech of age index `ageIndex`. */
export const techRenown = (ageIndex) => RENOWN.techBase + RENOWN.techPerAge * Math.max(0, ageIndex);

/** The time trickle due on `turn`: RENOWN.timePerRefTurn a reference turn, paid in one lump every
 * TIME_RENOWN_REF_TURNS reference turns (speedTurns), so it is the same at every speed; else 0. */
export const timeRenown = (speedId, ageId, turn) => {
  const every = speedTurns(TIME_RENOWN_REF_TURNS, speedId, ageId);
  return turn % every === 0 ? RENOWN.timePerRefTurn * TIME_RENOWN_REF_TURNS * (every / (TIME_RENOWN_REF_TURNS * speedCostMult(speedId, ageId))) : 0;
};

/** An era legacy: its renown and one virtue point, the point at most ERA_LEGACY_VIRTUE_MAX a game. */
export const grantEraLegacy = (nation, turn, ageId) => {
  const next = grantRenown(nation, 'eraLegacy', RENOWN.eraLegacy, turn, ageId);
  if (!next?.ruler || (next.ruler.bonusVirtuePoints || 0) >= ERA_LEGACY_VIRTUE_MAX) return next;
  return { ...next, ruler: { ...next.ruler, bonusVirtuePoints: (next.ruler.bonusVirtuePoints || 0) + 1 } };
};

/** A lost civil war humbles the ruler: the progress toward the next level is gone, and so is the
 * free reshape of `ageId` (the nation's age now). */
export const humbleRuler = (nation, ageId) => {
  const ruler = nation?.ruler;
  if (!ruler) return nation;
  return { ...nation, ruler: { ...ruler, renown: renownForLevel(rulerLevel(ruler.renown)), reshapeAge: ageId } };
};
