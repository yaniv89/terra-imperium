// src/audio/pageLifecycle.js
// Is the game on screen, so sound may play? One place that listens to every signal a browser or
// the app shell gives when the player stops looking: the tab hidden (visibilitychange), the page
// put away or frozen (pagehide, freeze), the window losing focus on a phone (blur: a locked
// iPhone or the app switcher), and the Capacitor app going to the background (pause / resume).
// The shared Web Audio context (audioContext.js) is suspended while the page is away and resumed
// when it is back; music.js and battleAudio.js also mute their buses. (Nothing plays as a media
// element: iOS would keep that going on the lock screen whatever the page does.)

/** Should sound be heard, given the page's state? (pure) Blur counts on phones only. */
export const pageAudible = ({ hidden = false, pagehidden = false, frozen = false, blurred = false, appPaused = false, phone = false } = {}) =>
  !hidden && !pagehidden && !frozen && !appPaused && !(phone && blurred);

const state = { hidden: false, pagehidden: false, frozen: false, blurred: false, appPaused: false };
const listeners = new Set();
let installed = false;
let lastAudible = true;

const hasDoc = () => typeof document !== 'undefined';
const isPhone = () => {
  if (!hasDoc()) return false;
  const layout = document.documentElement?.dataset?.layout || '';
  if (layout.startsWith('phone')) return true;
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches; } catch { return false; }
};

/** The page's state now (read live, plus the events seen so far). */
export const pageAudioState = () => ({ ...state, hidden: hasDoc() ? !!document.hidden || state.hidden : state.hidden, phone: isPhone() });
export const isPageAudible = () => pageAudible(pageAudioState());

const notify = () => {
  const now = isPageAudible();
  if (now === lastAudible) return;
  lastAudible = now;
  listeners.forEach((fn) => { try { fn(now); } catch { /* a listener's own problem */ } });
};
const set = (patch) => { Object.assign(state, patch); notify(); };

/** Start listening (idempotent; does nothing outside a browser). */
export const installPageLifecycle = () => {
  if (installed || !hasDoc() || typeof window === 'undefined') return;
  installed = true;
  const on = (target, name, fn) => target?.addEventListener?.(name, fn);
  on(document, 'visibilitychange', () => set({ hidden: !!document.hidden, ...(document.hidden ? {} : { pagehidden: false, frozen: false, appPaused: false }) }));
  on(window, 'pagehide', () => set({ pagehidden: true }));
  on(window, 'pageshow', () => set({ pagehidden: false }));
  on(document, 'freeze', () => set({ frozen: true }));
  on(document, 'resume', () => set({ frozen: false, appPaused: false })); // also Cordova/Capacitor's document 'resume'
  on(document, 'pause', () => set({ appPaused: true })); // Cordova/Capacitor's document 'pause'
  on(window, 'blur', () => set({ blurred: true }));
  on(window, 'focus', () => set({ blurred: false }));
  // Capacitor's App plugin, when the native shell carries it (no import: the web build lacks it).
  try {
    const app = window.Capacitor?.Plugins?.App;
    app?.addListener?.('pause', () => set({ appPaused: true }));
    app?.addListener?.('resume', () => set({ appPaused: false }));
    app?.addListener?.('appStateChange', (s) => set({ appPaused: !s?.isActive }));
  } catch { /* no native shell */ }
  lastAudible = isPageAudible();
};

/** fn(audible) whenever the answer changes. Returns the unsubscribe function. */
export const subscribePageAudio = (fn) => {
  installPageLifecycle();
  lastAudible = isPageAudible();
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Tests: drive the state by hand ({ hidden, blurred, ... }) and reset it. */
export const setPageStateForTest = (patch) => set(patch);
export const resetPageStateForTest = () => { Object.assign(state, { hidden: false, pagehidden: false, frozen: false, blurred: false, appPaused: false }); lastAudible = isPageAudible(); };
