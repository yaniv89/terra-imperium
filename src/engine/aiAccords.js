// src/engine/aiAccords.js
// The AI's accords (plans/civ-map-rework.md C6; the player's side is accords.js). Every
// AI_ACCORD_PERIOD turns, on its own slot, an AI nation looks at the nations whose cities touch
// its own:
//   open borders  two AI nations at peace that each hold the other at AI_OPEN_BORDERS_OPINION or
//                 more (the plain standing of 8: no grievance between them; the player's bar is
//                 OPEN_BORDERS_OPINION, 20, since AI opinions of each other cluster at the
//                 baseline) open their borders to each other (setOpenBorders, both records); a
//                 pair whose opinion fell under AI_CLOSE_BORDERS_OPINION closes them again (a war
//                 closes them at once, declareWar).
//   tribute       a Tier-1 nation at least AI_DEMAND_RATIO times as strong as a touching nation
//                 demands tribute: from an AI by the same score the player's demand uses
//                 (applyDemand with a demander); from the player as `state.pendingDemand`, a
//                 card on the Diplomacy tab (ANSWER_DEMAND) and a next prompt, counted as refused
//                 after DEMAND_ANSWER_TURNS. A refusal gives the casus belli of accords.js.
// Pure: returns the next nations, the logs and the pending demand.
import { getTouchingIds } from '../data/regions';
import { getNationTier } from '../utils/aiLogic';
import { DEMAND_COOLDOWN_TURNS, DEMAND_CB_TURNS, DEMAND_TRIBUTE_SHARE, DEMAND_TRIBUTE_MIN, DEMANDS, hasOpenBorders, setOpenBorders, applyDemand, demandAcceptance } from './accords';
import { opinionOf } from './opinion';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { isWarBetween } from './diplomacy';

export const AI_ACCORD_PERIOD = 10;
export const AI_OPEN_BORDERS_OPINION = 8;
export const AI_CLOSE_BORDERS_OPINION = 0;
export const AI_DEMAND_RATIO = 2;
export const DEMAND_ANSWER_TURNS = 3;

const atWar = (state, a, b) => (state.wars || []).some((w) => w.active && isWarBetween(w, a, b));
const related = (nations, a, b) => nations[a]?.vassalOf === b || nations[b]?.vassalOf === a;

/** The nations whose cities touch one of `nationId`'s cities, sorted. The cities-by-nation
 * index is kept per regions map, so a turn's slot nations share one scan. */
const byOwnerCache = new WeakMap(); // regions -> Map nationId -> [city]
const citiesByOwner = (regions) => {
  let m = byOwnerCache.get(regions);
  if (!m) { m = new Map(); Object.values(regions).forEach((c) => { if (!c.owner) return; const l = m.get(c.owner); if (l) l.push(c); else m.set(c.owner, [c]); }); byOwnerCache.set(regions, m); }
  return m;
};
export const touchingNations = (state, nationId) => {
  const out = new Set();
  (citiesByOwner(state.regions || {}).get(nationId) || []).forEach((c) => {
    getTouchingIds(c.id).forEach((id) => { const o = state.regions[id]?.owner; if (o && o !== nationId && state.nations?.[o] && !state.nations[o].isEliminated) out.add(o); });
  });
  return [...out].sort();
};

/** The tribute `targetId` would owe today. */
export const tributeOf = (state, targetId) => {
  const gold = targetId === state.playerNationId ? state.resources?.gold || 0 : state.nations?.[targetId]?.economy?.gold || 0;
  return Math.max(0, Math.round(Math.max(DEMAND_TRIBUTE_MIN, gold * DEMAND_TRIBUTE_SHARE)));
};

const slotOf = (ids, id) => ids.indexOf(id) % AI_ACCORD_PERIOD;

/** The AI accords of this turn. `nations` is the turn's working copy (read, not mutated). */
export const processAIAccords = (state, nations, { turn, sortedByMilitary }) => {
  const me = state.playerNationId;
  const logs = [];
  let next = nations;
  let pendingDemand = state.pendingDemand || null;
  const view = () => ({ ...state, nations: next });
  // A demand on the player left unanswered counts as refused.
  if (pendingDemand && turn > pendingDemand.until) {
    const from = next[pendingDemand.from];
    if (from && !from.isEliminated) {
      next = { ...next, [pendingDemand.from]: { ...from, demandCasusBelli: { ...(from.demandCasusBelli || {}), [me]: turn + DEMAND_CB_TURNS }, hostility: Math.min(100, (from.hostility || 0) + DEMANDS[pendingDemand.kind].hostility) } };
      logs.push({ year: state.year, message: `${from.name} takes your silence as a refusal: they hold a casus belli against you for ${DEMAND_CB_TURNS} turns.`, type: 'diplomacy' });
    }
    pendingDemand = null;
  }
  const ids = Object.keys(nations).filter((id) => id !== me && !nations[id].isEliminated && !nations[id].isPlayer).sort();
  const active = ids.filter((id) => slotOf(ids, id) === turn % AI_ACCORD_PERIOD);
  active.forEach((a) => {
    const around = touchingNations(view(), a);
    around.forEach((b) => {
      if (b === me || atWar(state, a, b) || related(next, a, b)) return;
      const ab = opinionOf(view(), a, b); const ba = opinionOf(view(), b, a);
      const open = hasOpenBorders(view(), a, b);
      if (!open && ab >= AI_OPEN_BORDERS_OPINION && ba >= AI_OPEN_BORDERS_OPINION) next = setOpenBorders(next, a, b, true);
      else if (open && (ab < AI_CLOSE_BORDERS_OPINION || ba < AI_CLOSE_BORDERS_OPINION)) next = setOpenBorders(next, a, b, false);
    });
    if (getNationTier(view(), a, sortedByMilitary) !== 1) return;
    const power = getEffectiveMilitaryPower(view(), a);
    const cooldowns = next[a].demandCooldowns || {};
    const prey = around
      .filter((b) => !atWar(state, a, b) && !related(next, a, b) && !(cooldowns[b] != null && turn < cooldowns[b]) && power / Math.max(1, getEffectiveMilitaryPower(view(), b)) >= AI_DEMAND_RATIO)
      .sort((x, y) => getEffectiveMilitaryPower(view(), x) - getEffectiveMilitaryPower(view(), y))[0];
    if (!prey) return;
    if (prey === me) {
      if (pendingDemand) return;
      pendingDemand = { from: a, kind: 'tribute', amount: tributeOf(view(), me), turn, until: turn + DEMAND_ANSWER_TURNS };
      next = { ...next, [a]: { ...next[a], demandCooldowns: { ...cooldowns, [me]: turn + DEMAND_COOLDOWN_TURNS } } };
      logs.push({ year: state.year, message: `${next[a].name} demands ${pendingDemand.amount} gold in tribute. Answer on the Diplomacy tab within ${DEMAND_ANSWER_TURNS} turns, or they take it as a refusal.`, type: 'diplomacy' });
      return;
    }
    const r = applyDemand(view(), prey, 'tribute', null, a);
    if (r.state === view()) return;
    next = r.state.nations;
    if (r.accepted) logs.push({ nationId: a, year: state.year, message: r.message, type: 'diplomacy' });
  });
  return { nations: next, logs, pendingDemand };
};

/** The player's answer to a pending demand: { state, message }. */
export const answerDemand = (state, accept) => {
  const d = state.pendingDemand;
  if (!d) return { state, message: null };
  const from = state.nations[d.from];
  const turn = state.turnNumber || 1;
  if (!from || from.isEliminated) return { state: { ...state, pendingDemand: null }, message: null };
  if (accept) {
    const amount = Math.min(d.amount, Math.max(0, state.resources.gold || 0));
    const nations = { ...state.nations, [d.from]: { ...from, economy: { ...(from.economy || {}), gold: (from.economy?.gold || 0) + amount }, hostility: Math.max(0, (from.hostility || 0) - 5) } };
    return { state: { ...state, nations, resources: { ...state.resources, gold: (state.resources.gold || 0) - amount }, pendingDemand: null }, message: `You pay ${from.name} ${amount} gold in tribute.` };
  }
  const nations = { ...state.nations, [d.from]: { ...from, demandCasusBelli: { ...(from.demandCasusBelli || {}), [state.playerNationId]: turn + DEMAND_CB_TURNS }, hostility: Math.min(100, (from.hostility || 0) + DEMANDS[d.kind].hostility) } };
  return { state: { ...state, nations, pendingDemand: null }, message: `You refuse ${from.name}: they hold a casus belli against you for ${DEMAND_CB_TURNS} turns.` };
};

// For the unit tests and the prompt: is a demand waiting for the player?
export const demandWaiting = (state) => !!state.pendingDemand && !!state.nations?.[state.pendingDemand.from] && !state.nations[state.pendingDemand.from].isEliminated;
export { demandAcceptance };
