// src/hooks/useLayoutMode.js
// One answer to "which layout is this screen?" for the whole app:
//   'desktop'          1024 px and wider (and not a phone): side panels, full header
//   'tablet'           a tablet or a narrow window held sideways (narrower than 1024, wider than
//                      tall, not phone-sized): the landscape shell of the phone with a wider dock
//                      (420 px), and the city card and a tile or army sheet stacked on the left
//   'tablet-portrait'  a tablet or a narrow window held upright: the bottom tab bar and bottom
//                      sheets (useIsMobile)
//   'phone-landscape'  a phone held sideways (short side <= 500 px): a slim top bar, a tab rail on
//                      the right edge, docked side panels, the map kept in the middle
//   'phone-portrait'   a phone held upright: the empire view plays with the map on top and half
//                      sheets below (the bottom-bar layout, useIsMobile), with a soft hint to turn
//                      the phone (RotateOverlay); battles ask to rotate for real
// The mode is also written to <html data-layout="…"> so CSS can follow it: the `pl:` Tailwind
// variant (tailwind.config.js) and the .sheet-backdrop / .sheet-panel rules in index.css.
import { useSyncExternalStore } from 'react';

export const PHONE_SHORT_SIDE_MAX = 500;
// A wide but short desktop window is not a phone.
const PHONE_LONG_SIDE_MAX = 1000;
const DESKTOP_MIN_WIDTH = 1024;
// The rotate hint, once dismissed, stays dismissed per browser.
export const ROTATE_HINT_STORAGE_KEY = 'terra-imperium-portrait-ok';

export const getLayoutMode = (width, height) => {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const phone = short <= PHONE_SHORT_SIDE_MAX && long <= PHONE_LONG_SIDE_MAX;
  if (phone && width > height) return 'phone-landscape';
  if (phone) return 'phone-portrait';
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
  return width > height ? 'tablet' : 'tablet-portrait';
};

/** The landscape shell (a slim top bar, the tab rail on the right, docked sheets): a phone held
 * sideways or a tablet held sideways. The `pl:` Tailwind variant matches the same two modes. */
export const isLandscapeShell = (mode) => mode === 'phone-landscape' || mode === 'tablet';

const listeners = new Set();

const compute = () => (typeof window === 'undefined' ? 'desktop' : getLayoutMode(window.innerWidth, window.innerHeight));

let current = compute();
const publish = () => {
  const next = compute();
  if (typeof document !== 'undefined') document.documentElement.dataset.layout = next;
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
};
if (typeof document !== 'undefined') document.documentElement.dataset.layout = current;

const subscribe = (listener) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('resize', publish);
    window.addEventListener('orientationchange', publish);
  }
  publish();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('resize', publish);
      window.removeEventListener('orientationchange', publish);
    }
  };
};

export const useLayoutMode = () => useSyncExternalStore(subscribe, () => current, () => 'desktop');

// The rotate hint (RotateOverlay): shown on a phone held upright until dismissed, remembered per
// browser. Dismissing changes no layout: portrait plays the empire view either way.
let hintDismissed = (() => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(ROTATE_HINT_STORAGE_KEY) === '1'; } catch { return false; } })();
const hintListeners = new Set();
export const isRotateHintDismissed = () => hintDismissed;
export const dismissRotateHint = () => {
  hintDismissed = true;
  try { localStorage.setItem(ROTATE_HINT_STORAGE_KEY, '1'); } catch { /* storage disabled: lasts this session */ }
  hintListeners.forEach((l) => l());
};
const subscribeHint = (l) => { hintListeners.add(l); return () => hintListeners.delete(l); };
export const useRotateHintDismissed = () => useSyncExternalStore(subscribeHint, () => hintDismissed, () => true);
