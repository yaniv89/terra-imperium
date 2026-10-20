// src/utils/launchDecision.js
// What the app shows when the page opens (playtest audit X26). Pure, so a test can pin it.
//
// The rule: every launch (a fresh page load, a reload, an installed or Capacitor app start) with a
// readable save shows the title screen first. The game never resumes by itself, not even in the
// middle of a battle or a decision: Continue is one tap, and a battle checkpoint or an open event
// is still there when the player taps it.
//   'game'   a new game chosen on another world is waiting for this page (GameContext
//            takePendingStart): that is the player's own fresh choice, it starts at once
//   'title'  a readable save exists: Continue, New game, Load, Settings
//   'start'  no save to resume (first visit, cleared storage, a save this build cannot read): the
//            new game steps, as before
import { migrateSave, saveProblem } from '../engine/saveMigrations';
import { yearLabel } from '../components/ui/topBarModel';
import { keepWorldRegistry } from '../engine/world/registry';

export const launchScreen = ({ pendingStart = false, hasSave = false } = {}) => {
  if (pendingStart) return 'game';
  return hasSave ? 'title' : 'start';
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "3 days ago": how long since the save was written. */
export const playedAgo = (savedAt, now = Date.now()) => {
  if (!Number.isFinite(savedAt)) return '';
  const ms = Math.max(0, now - savedAt);
  const n = (v, unit) => `${v} ${unit}${v === 1 ? '' : 's'} ago`;
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return n(Math.floor(ms / MINUTE), 'minute');
  if (ms < DAY) return n(Math.floor(ms / HOUR), 'hour');
  if (ms < 60 * DAY) return n(Math.floor(ms / DAY), 'day');
  return n(Math.floor(ms / (30 * DAY)), 'month');
};

/**
 * What a stored save is, for the title screen and the Load list.
 * Returns { status: 'none' } | { status: 'old', reason } (cannot be read by this build, never
 * deleted) | { status: 'ok', nation, turn, year, savedAt, gameOver }.
 */
export const describeSave = (raw) => {
  if (raw === null || raw === undefined || raw === '') return { status: 'none' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { status: 'old', reason: 'corrupt' }; }
  let migrated = null;
  // Reading a save for its card must not move the game on screen: migrateSave builds a fresh game
  // to backfill from, which syncs the city registry to that fresh world (playtest 4 H1, C2).
  try { migrated = keepWorldRegistry(() => migrateSave(parsed)); } catch (e) { migrated = null; }
  if (!migrated) return { status: 'old', reason: saveProblem(parsed) || 'corrupt' };
  const s = migrated.state;
  const nation = s.nations?.[s.playerNationId]?.name || s.playerNationId || 'Unknown people';
  return {
    status: 'ok',
    nation,
    nationId: s.playerNationId || null,
    yearValue: Number.isFinite(s.year) ? s.year : null,
    turn: s.turnNumber ?? 1,
    year: Number.isFinite(s.year) ? yearLabel(s.year) : '',
    savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : null,
    gameOver: !!s.gameStatus && s.gameStatus !== 'ACTIVE' && s.gameStatus !== 'active'
  };
};
