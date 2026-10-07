// src/components/ui/endTurnModel.js
// The End Turn button as a call to action (W10, TurnDock.jsx). Pure. While something must be
// answered (src/engine/turnBlockers.js) the button names the first thing ("Choose production:
// Kish") with a "+N" badge for the rest, and a tap goes there; with nothing left it reads "End
// Turn" and ends the turn. Units that can still move never block: with the "warn me" setting on
// they arm one soft confirmation ("End anyway? N waiting"), nothing more.
import { turnBlockers } from '../../engine/turnBlockers';
import { GameStatus } from '../../data/types';
import { endTurnWarnings } from './nextPromptModel';

/**
 * { mode, label, badge, blocker, count }:
 *   'hidden'   the game is over
 *   'moving'   the turn worker runs ("The world moves...")
 *   'blocker'  label = the first blocker's, badge '+N' for the others (null for one)
 *   'armed'    the soft confirmation is armed ("End anyway? N waiting")
 *   'ready'    "End Turn"
 */
export const endTurnButton = (state, { turnPending = false, armed = false } = {}) => {
  if (state.gameStatus !== GameStatus.ACTIVE) return { mode: 'hidden', label: '', badge: null, blocker: null, count: 0 };
  if (turnPending) return { mode: 'moving', label: 'The world moves…', badge: null, blocker: null, count: 0 };
  const blockers = turnBlockers(state);
  if (blockers.length) return { mode: 'blocker', label: blockers[0].label, badge: blockers.length > 1 ? `+${blockers.length - 1}` : null, blocker: blockers[0], count: blockers.length };
  const warnings = endTurnWarnings(state);
  if (armed && warnings > 0) return { mode: 'armed', label: `End anyway? ${warnings} waiting`, badge: null, blocker: null, count: 0 };
  return { mode: 'ready', label: 'End Turn', badge: null, blocker: null, count: 0 };
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
