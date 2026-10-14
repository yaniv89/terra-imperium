// src/utils/crashLog.js
// Evidence for the next crash hunt (an iPhone page over its memory limit is killed without an error
// and the home-screen app reloads it). Nothing here is shown to the player.
// Each page load is a "session" in localStorage: where the player was (screen, turn), when the page
// was last seen and whether it closed normally (pagehide). A session that never closed and was in
// front when last seen ended in a crash or a forced reload. The last sessions, the error lines and
// the WebGL context losses are kept (a few kB at most). Read it with `?crashlog` (a small overlay)
// or window.__crashLog() in the console. Every write is guarded: storage may be full or blocked.

export const CRASH_LOG_KEY = 'terra-imperium-crash-log';
const MAX_SESSIONS = 12;
const MAX_EVENTS = 20;

const read = (storage) => {
  try { const v = JSON.parse(storage?.getItem(CRASH_LOG_KEY) || 'null'); return v && Array.isArray(v.sessions) ? v : { sessions: [] }; } catch { return { sessions: [] }; }
};
const write = (storage, log) => { try { storage?.setItem(CRASH_LOG_KEY, JSON.stringify(log)); } catch { /* full or blocked: the log is best effort */ } };

/** How the last session ended: 'closed', 'background' (killed while hidden), 'crash' (killed or
 * reloaded while in front) or null (no last session). */
export const endingOf = (s) => {
  if (!s) return null;
  if (s.closed) return 'closed';
  return s.hidden ? 'background' : 'crash';
};

/**
 * Start this page's session (once, at boot). `now` and `storage` for tests. Returns the log with
 * `last` (the previous session and how it ended) and `streak` (crashes in a row before this load).
 */
export const createCrashLog = ({ storage = safeLocalStorage(), now = () => Date.now() } = {}) => {
  const log = read(storage);
  const prev = log.sessions[log.sessions.length - 1] || null;
  if (prev && !prev.ending) prev.ending = endingOf(prev);
  let streak = 0;
  for (let i = log.sessions.length - 1; i >= 0 && log.sessions[i].ending === 'crash'; i--) streak += 1;
  const session = { start: now(), seen: now(), screen: 'boot', turn: null, closed: false, hidden: false, events: [] };
  log.sessions.push(session);
  while (log.sessions.length > MAX_SESSIONS) log.sessions.shift();
  write(storage, log);
  const save = () => { session.seen = now(); write(storage, log); };
  const api = {
    last: prev ? { ...prev } : null,
    streak,
    /** Where the player is now: 'title', 'start', 'map', 'battle', 'result' ... */
    screen(name, turn) { if (session.screen === name && (turn === undefined || turn === session.turn)) return; session.screen = name; if (turn !== undefined) session.turn = turn; save(); },
    turn(n) { if (session.turn === n) return; session.turn = n; save(); },
    /** Something worth knowing: 'map-context-lost', 'error: ...'. */
    event(kind) { session.events.push({ at: now() - session.start, kind: String(kind).slice(0, 160) }); while (session.events.length > MAX_EVENTS) session.events.shift(); save(); },
    hidden(on) { session.hidden = !!on; save(); },
    closed() { session.closed = true; save(); },
    reopened() { session.closed = false; save(); },
    read: () => read(storage),
    summary() {
      const l = read(storage);
      return l.sessions.map((s) => `${new Date(s.start).toISOString().slice(5, 16)} ${endingOf(s) || 'now'} on ${s.screen}${s.turn != null ? ` turn ${s.turn}` : ''}${s.events?.length ? ` | ${s.events.map((e) => e.kind).join('; ')}` : ''}`).join('\n');
    }
  };
  return api;
};

function safeLocalStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

// ---- the page's own log -------------------------------------------------------------------
let current = null;
/** The page's crash log, started on first use. */
export const crashLog = () => {
  if (!current) current = createCrashLog();
  return current;
};
export const noteScreen = (name, turn) => { try { crashLog().screen(name, turn); } catch { /* never breaks the game */ } };
export const noteTurn = (n) => { try { crashLog().turn(n); } catch { /* never breaks the game */ } };
export const noteCrashEvent = (kind) => { try { crashLog().event(kind); } catch { /* never breaks the game */ } };

/** At boot: start the session, follow visibility and close, catch stray errors into the log. */
export const installCrashLog = (win = typeof window !== 'undefined' ? window : null) => {
  if (!win) return null;
  const log = crashLog();
  try {
    win.addEventListener('pagehide', () => log.closed());
    win.addEventListener('pageshow', (e) => { if (e.persisted) log.reopened(); });
    win.document?.addEventListener('visibilitychange', () => log.hidden(win.document.visibilityState === 'hidden'));
    win.addEventListener('error', (e) => log.event(`error: ${e?.message || 'unknown'}`));
    win.addEventListener('unhandledrejection', (e) => log.event(`rejection: ${e?.reason?.message || String(e?.reason || 'unknown')}`));
    win.__crashLog = () => log.summary();
    if (log.last && log.last.ending === 'crash') {
      console.info(`[crash log] the last session ended without closing (on ${log.last.screen}${log.last.turn != null ? `, turn ${log.last.turn}` : ''}); ${log.streak} in a row. window.__crashLog() for more.`);
    }
    if (/[?&]crashlog\b/.test(win.location?.search || '')) {
      const el = win.document.createElement('pre');
      el.setAttribute('data-testid', 'crash-log');
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:90vw;max-height:40vh;overflow:auto;margin:0;padding:6px 8px;background:rgba(0,0,0,.8);color:#e5e7eb;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';
      el.textContent = log.summary();
      win.document.body?.appendChild(el);
    }
  } catch { /* the log is best effort */ }
  return log;
};
