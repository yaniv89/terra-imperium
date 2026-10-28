// src/components/ui/endTurnModel.js
// The End Turn button as a call to action (W10, TurnDock.jsx). Pure. While something must be
// answered (src/engine/turnBlockers.js) the button names the first thing ("Choose production:
// Kish") with a "+N" badge for the rest, and a tap goes there; with nothing left it reads "End
// Turn" and ends the turn. Units that can still move never block: with the "warn me" setting on
// they arm one soft confirmation ("End anyway? N waiting"), nothing more.
import { turnBlockers } from '../../engine/turnBlockers';
import { GameStatus } from '../../data/types';
import { endTurnWarnings } from './nextPromptModel';
import { t as tNow } from '../../i18n';
import { calcNationBalance } from '../../engine/economy';
import { rushQuote } from '../../engine/spending';

/**
 * { mode, label, badge, blocker, count, idleCities }:
 *   'hidden'   the game is over
 *   'moving'   the turn worker runs ("The world moves...")
 *   'blocker'  label = the first blocker's, badge '+N' for the others (null for one)
 *   'armed'    the soft confirmation is armed ("End anyway? N waiting")
 *   'ready'    "End Turn"
 * idleCities: how many cities wait for production (the "Advisor builds" button beside it fills them
 * all in one tap, productionAdvisor.js); 0 unless the mode is 'blocker'.
 */
export const endTurnButton = (state, { turnPending = false, armed = false } = {}) => {
  if (state.gameStatus !== GameStatus.ACTIVE) return { mode: 'hidden', label: '', badge: null, blocker: null, count: 0 };
  if (turnPending) return { mode: 'moving', label: tNow('turn.moves'), badge: null, blocker: null, count: 0 };
  const blockers = turnBlockers(state);
  if (blockers.length) return { mode: 'blocker', label: blockers[0].label, badge: blockers.length > 1 ? `+${blockers.length - 1}` : null, blocker: blockers[0], count: blockers.length, idleCities: blockers.filter((b) => b.kind === 'city').length };
  const warnings = endTurnWarnings(state);
  if (armed && warnings > 0) return { mode: 'armed', label: tNow('turn.endAnyway', { n: warnings }), badge: null, blocker: null, count: 0 };
  return { mode: 'ready', label: tNow('turn.end'), badge: null, blocker: null, count: 0 };
};

/**
 * What a tap (or Enter) does: { go: blocker } opens that blocker, { arm: true } arms the soft
 * confirmation, { end: true } ends the turn, { none: true } while the turn runs or the game is over.
 */
export const endTurnPress = (state, { turnPending = false, armed = false } = {}) => {
  const b = endTurnButton(state, { turnPending, armed });
  if (b.mode === 'hidden' || b.mode === 'moving') return { none: true };
  if (b.mode === 'blocker') return { go: b.blocker };
  if (b.mode === 'ready' && endTurnWarnings(state) > 0) return { arm: true };
  return { end: true };
};

// The dock's "Buy" chip (lane gold-sinks): round 2 playtesters piled up 36,000 gold in the "Advisor
// builds, End Turn" loop without finding the rush buy (spending.js). While the treasury holds more than
// BUY_HINT_INCOME_TURNS turns of net income, the chip offers the current order that saves the most turns
// for its price, keeping that reserve; one tap is one RUSH_PRODUCTION, so the city's rush heat raises the
// next price and the chip moves on or goes away. Never a blocker.
export const BUY_HINT_INCOME_TURNS = 10;
/** { cityId, name, gold, turns } for the chip, or null. */
export const buyHint = (state) => {
  const me = state.playerNationId;
  const gold = state.resources?.gold || 0;
  const reserve = Math.max(0, BUY_HINT_INCOME_TURNS * calcNationBalance(state, me).net);
  let best = null;
  for (const c of Object.values(state.regions || {})) {
    if (c.owner !== me || !c.production?.current) continue;
    const q = rushQuote(state, c.id, 0);
    if (!q.ok || !(q.turns > 1) || gold - q.gold < reserve) continue;
    if (!best || q.turns / q.gold > best.turns / best.gold) best = { cityId: c.id, name: c.name, gold: q.gold, turns: q.turns };
  }
  return best;
};
