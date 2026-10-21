// src/engine/decrees.js
// The ruler's decrees (differentiation plan U6, KTD4, KTD5): a bank on nation.ruler.decrees,
// capped at decreeCap (3, plus 1 at Majesty 4 and at Majesty 8). Deeds grant one decree each where
// they happen (a war won in peace.js, each era goal met in eraGoals.js, a wonder completed in
// resolveTurn's great projects phase). The trickle is a floor: while the bank holds fewer than
// DECREE_TRICKLE_BELOW the ruler
// counts turns (ruler.decreeWait) and gets one decree after
//   speedTurns(max(MIN, REF - PER_ADM x (adm - 3 + pace)) x (legitimacy < 50 ? 1.5 : 1), speed, ageOf)
// where pace is the national.decreePace modifier (reforms, techs, wonders, an advisor: KTD5).
// turns. Every grant and spend is kept in ruler.decreeLog (newest first) for the UI's reason lines.
// Pure: every function returns the same nation when nothing changes.
import {
  DECREE_CAP_BASE, DECREE_CAP_MAJESTY_STEPS, DECREE_TRICKLE_REF_TURNS, DECREE_TRICKLE_ADM_START,
  DECREE_TRICKLE_REF_TURNS_PER_ADM, DECREE_TRICKLE_MIN_REF_TURNS, DECREE_LOW_LEGITIMACY,
  DECREE_LOW_LEGITIMACY_MULT, DECREE_LOG_SIZE, DECREE_TRICKLE_BELOW, DECREE_DEEDS, DECREE_ACTS
} from '../data/decrees';
import { speedTurns } from '../data/ages';
import { ageOf } from './nationState';
import { getModifier } from './modifiers/sheet';

export const decreesOf = (nation) => nation?.ruler?.decrees || 0;

export const decreeCap = (nation) => DECREE_CAP_BASE + DECREE_CAP_MAJESTY_STEPS.filter((m) => (nation?.ruler?.maj || 0) >= m).length;

/** Decrees an act of state spends (0 for an act that spends none). */
export const decreeCostOf = (actId) => DECREE_ACTS[actId]?.decrees || 0;

const logged = (ruler, entry) => [entry, ...(ruler.decreeLog || [])].slice(0, DECREE_LOG_SIZE);

/** One decree for a deed (a key of DECREE_DEEDS); `detail` names it (the war, the goal, the wonder).
 * A nation without a ruler or with a full bank is returned unchanged. */
export const grantDecree = (nation, deed, turn, detail = null) => {
  const ruler = nation?.ruler;
  if (!ruler || decreesOf(nation) >= decreeCap(nation)) return nation;
  return { ...nation, ruler: { ...ruler, decrees: decreesOf(nation) + 1, decreeWait: 0, decreeLog: logged(ruler, { turn, deed, detail, n: 1 }) } };
};

export const canSpendDecree = (nation, actId, n = decreeCostOf(actId)) => n > 0 && decreesOf(nation) >= n;

/** Spends an act's decrees (`n`, default the act's own count); refused (the same nation) when the bank is short. */
export const spendDecree = (nation, actId, turn, n = decreeCostOf(actId)) => {
  if (!canSpendDecree(nation, actId, n)) return nation;
  return { ...nation, ruler: { ...nation.ruler, decrees: decreesOf(nation) - n, decreeLog: logged(nation.ruler, { turn, act: actId, n: -n }) } };
};

/** Turns between trickle decrees for this nation now, at its speed and in its own age. */
export const trickleTurns = (state, nationId, nation = state.nations?.[nationId]) => {
  const adm = nation?.ruler?.adm ?? DECREE_TRICKLE_ADM_START;
  const pace = state.nations?.[nationId] ? getModifier(state, nationId, 'national.decreePace').total : 0;
  const ref = Math.max(DECREE_TRICKLE_MIN_REF_TURNS, DECREE_TRICKLE_REF_TURNS - DECREE_TRICKLE_REF_TURNS_PER_ADM * (adm - DECREE_TRICKLE_ADM_START + pace));
  const legit = (nation?.legitimacy ?? 50) < DECREE_LOW_LEGITIMACY ? DECREE_LOW_LEGITIMACY_MULT : 1;
  return speedTurns(ref * legit, state.gameSpeed, ageOf(state, nationId));
};

/** The rulers phase, once a turn per nation: the floor counts only while the bank holds fewer than DECREE_TRICKLE_BELOW. */
export const tickDecrees = (state, nationId, nation, turn) => {
  const ruler = nation?.ruler;
  if (!ruler) return nation;
  if (decreesOf(nation) >= DECREE_TRICKLE_BELOW) return ruler.decreeWait ? { ...nation, ruler: { ...ruler, decreeWait: 0 } } : nation;
  const wait = (ruler.decreeWait || 0) + 1;
  if (wait >= trickleTurns(state, nationId, nation)) return grantDecree(nation, 'trickle', turn);
  return { ...nation, ruler: { ...ruler, decreeWait: wait } };
};

/** A plain line for one decreeLog entry: "+1 War won: Rome" or "-2 Change the government". */
export const decreeReason = (entry) => {
  const what = entry.deed ? DECREE_DEEDS[entry.deed] : DECREE_ACTS[entry.act]?.label;
  return `${entry.n > 0 ? '+' : ''}${entry.n} ${what}${entry.detail ? `: ${entry.detail}` : ''}`;
};
