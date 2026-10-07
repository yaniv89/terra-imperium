// src/audio/audioContext.js
// The one Web Audio context of the game: map music and ambience (music.js), interface and world
// sounds and unit voices (sfx.js) and the battle (battleAudio.js) all play through it. Nothing in
// the game plays as a standalone media element (new Audio(), <audio>), on purpose:
//   - iOS treats a playing media element as "media playback": it keeps playing in the background
//     and on the lock screen, with Now Playing controls, whatever the page does (its timers and
//     events are throttled or frozen by then, so a pause call may never run).
//   - A Web Audio context is paused by iOS itself when the page goes to the background or the
//     screen locks (WebKit suspends it when the app resigns active), unless the page asks for the
//     'playback' audio session. We ask for 'ambient' (navigator.audioSession, Safari 16.4+), which
//     never plays in the background and mixes with other apps' audio. It also follows the ring /
//     silent switch, as Web Audio always did on iPhone.
// On top of that this module suspends the context itself whenever the page is away
// (pageLifecycle.js: hidden, put away, frozen, app paused, a phone's window blurred) and resumes it
// only when the page is back. iOS can leave the context 'interrupted' (a call, Siri, an alarm, or
// coming back from the background): resume() is tried at once and again on the next tap.
// The lock screen gets no media session: no metadata, playbackState 'none', no action handlers.
import { isPageAudible, subscribePageAudio, pageAudioState } from './pageLifecycle';

/**
 * What to do with the context (pure): 'suspend', 'resume' or 'none'.
 * state: the context's state ('running' | 'suspended' | 'interrupted' | 'closed' | null when none)
 * audible: the page is on screen (pageLifecycle.isPageAudible)
 */
export const contextAction = ({ state, audible }) => {
  if (!state || state === 'closed') return 'none';
  if (!audible) return state === 'running' ? 'suspend' : 'none';
  return state === 'running' ? 'none' : 'resume';
};

const LOG_MAX = 14;
let factory = null; // tests: () => context
let ctx = null;
let unsubscribePage = null;
let gestureArmed = false;
const log = [];
const consumers = new Map(); // name -> () => object, for the debug readout

const stamp = () => {
  try { return new Date().toTimeString().slice(0, 8); } catch { return ''; }
};
/** Remember a line for the ?audiodebug readout (newest first). */
export const audioLog = (msg) => {
  log.unshift(`${stamp()} ${msg}`);
  if (log.length > LOG_MAX) log.length = LOG_MAX;
};

const contextClass = () => (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext || null) : null);
/** Can this environment play Web Audio at all? (no in tests and headless runs) */
export const audioAvailable = () => !!(factory || contextClass());

/** Ask iOS for the 'ambient' audio session: never in the background, no lock screen controls. */
export const setAmbientAudioSession = () => {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.audioSession : null;
    if (s && s.type !== 'ambient') s.type = 'ambient';
  } catch { /* not supported */ }
};

const MEDIA_ACTIONS = ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'skipad'];
/** The lock screen must have nothing to show or restart: no metadata, no state, no handlers. */
export const clearMediaSession = () => {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
  if (!ms) return;
  try { ms.metadata = null; } catch { /* read-only here */ }
  try { ms.playbackState = 'none'; } catch { /* read-only here */ }
  MEDIA_ACTIONS.forEach((a) => { try { ms.setActionHandler?.(a, null); } catch { /* an action the browser does not know */ } });
};

const apply = (why) => {
  if (!ctx) return;
  const action = contextAction({ state: ctx.state, audible: isPageAudible() });
  if (action === 'suspend') {
    audioLog(`suspend (${why})`);
    try { ctx.suspend?.()?.catch?.(() => {}); } catch { /* already closed */ }
  } else if (action === 'resume') {
    audioLog(`resume from ${ctx.state} (${why})`);
    try {
      const p = ctx.resume?.();
      p?.then?.(() => { if (ctx && ctx.state !== 'running') armGesture(); }, () => armGesture());
    } catch { armGesture(); }
    // iOS may refuse until the next tap (an 'interrupted' context after a call or the background).
    if (ctx.state !== 'running') armGesture();
  }
};

// One-shot listeners: the next tap or key retries resume() (what iOS asks for after an interruption).
function armGesture() {
  if (gestureArmed || typeof window === 'undefined' || !window.addEventListener) return;
  gestureArmed = true;
  const go = () => {
    gestureArmed = false;
    ['pointerdown', 'touchend', 'keydown'].forEach((n) => window.removeEventListener(n, go, true));
    apply('tap');
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((n) => window.addEventListener(n, go, true));
}

/**
 * The shared context, created on first call from a user gesture (null without Web Audio, or when
 * `create` is false and there is none yet). The page being away keeps it suspended.
 */
export const getAudioContext = ({ create = true } = {}) => {
  if (ctx || !create) return ctx;
  const AC = contextClass();
  if (!factory && !AC) return null;
  setAmbientAudioSession();
  try { ctx = factory ? factory() : new AC(); } catch { ctx = null; return null; }
  audioLog(`context created (${ctx.state})`);
  try {
    ctx.addEventListener?.('statechange', () => {
      audioLog(`state ${ctx?.state}`);
      // iOS interrupted or resumed it on its own: put it back in line with the page.
      apply('statechange');
    });
  } catch { /* old browser */ }
  if (!unsubscribePage) {
    unsubscribePage = subscribePageAudio((audible) => {
      const p = pageAudioState();
      const why = audible ? 'page back' : `page away (${['hidden', 'pagehidden', 'frozen', 'appPaused'].filter((k) => p[k]).concat(p.phone && p.blurred ? ['blurred'] : []).join(', ')})`;
      audioLog(why);
      apply(why);
    });
  }
  clearMediaSession();
  apply('created');
  return ctx;
};

/** Call from a user gesture: create the context and resume it if the page is on screen. */
export const unlockAudio = () => {
  const c = getAudioContext();
  if (c) apply('gesture');
  return c;
};

/** Resume the context if the page is on screen (never while it is away). */
export const resumeAudio = (why = 'play') => apply(why);

/** The ?audiodebug readout registers what each player has going. */
export const registerAudioConsumer = (name, describe) => { consumers.set(name, describe); return () => consumers.delete(name); };

/** Everything the ?audiodebug readout shows. */
export const audioDebugInfo = () => {
  const page = pageAudioState();
  let session = 'n/a';
  try { session = (typeof navigator !== 'undefined' && navigator.audioSession?.type) || 'n/a'; } catch { /* none */ }
  let mediaSession = 'n/a';
  try { mediaSession = (typeof navigator !== 'undefined' && navigator.mediaSession?.playbackState) || 'n/a'; } catch { /* none */ }
  const parts = {};
  consumers.forEach((fn, name) => { try { parts[name] = fn(); } catch { parts[name] = { error: true }; } });
  return {
    context: ctx ? ctx.state : 'not created',
    time: ctx ? Number(ctx.currentTime || 0).toFixed(1) : '-',
    rate: ctx?.sampleRate || 0,
    audible: isPageAudible(),
    page,
    session,
    mediaSession,
    mediaElements: typeof document !== 'undefined' ? document.querySelectorAll?.('audio,video')?.length ?? 0 : 0,
    consumers: parts,
    log: [...log]
  };
};

/** Tests: use this context factory (null: the browser's) and forget the current context. */
export const resetAudioContextForTest = (makeContext = null) => {
  factory = makeContext;
  ctx = null;
  gestureArmed = false;
  log.length = 0;
  if (unsubscribePage) { unsubscribePage(); unsubscribePage = null; }
};
