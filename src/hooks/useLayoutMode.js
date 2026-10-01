// src/hooks/useLayoutMode.js
// One answer to "which layout is this screen?" for the whole app:
//   'desktop'          1024 px and wider (and not a phone): side panels, full header
//   'tablet'           narrower than 1024 but not phone-sized (a tablet, a narrow window): the
//                      bottom tab bar and bottom sheets
//   'phone-landscape'  a phone held sideways (short side <= 500 px): a slim top bar, a tab rail on
//                      the right edge, docked side panels, the map kept in the middle
//   'phone-portrait'   a phone held upright: the game asks to be rotated (RotateOverlay), unless the
//                      player chose to play in portrait anyway, which uses the 'tablet' layout
// The mode is also written to <html data-layout="…"> so CSS can follow it: the `pl:` Tailwind
// variant (tailwind.config.js) and the .sheet-backdrop / .sheet-panel rules in index.css.
import { useSyncExternalStore } from 'react';

export const PHONE_SHORT_SIDE_MAX = 500;
// A wide but short desktop window is not a phone.
const PHONE_LONG_SIDE_MAX = 1000;
const DESKTOP_MIN_WIDTH = 1024;
export const PORTRAIT_OK_STORAGE_KEY = 'terra-imperium-portrait-ok';

export const getLayoutMode = (width, height, portraitOk = false) => {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const phone = short <= PHONE_SHORT_SIDE_MAX && long <= PHONE_LONG_SIDE_MAX;
  if (phone && width > height) return 'phone-landscape';
  if (phone) return portraitOk ? 'tablet' : 'phone-portrait';
  return width >= DESKTOP_MIN_WIDTH ? 'desktop' : 'tablet';
};

const readPortraitOk = () => {
  try { return localStorage.getItem(PORTRAIT_OK_STORAGE_KEY) === '1'; } catch { return false; }
};

let portraitOk = typeof window !== 'undefined' ? readPortraitOk() : false;
const listeners = new Set();

const compute = () => (typeof window === 'undefined' ? 'desktop' : getLayoutMode(window.innerWidth, window.innerHeight, portraitOk));

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

// "Play in portrait anyway": remembered per browser, switches a phone held upright to the
// tablet layout (the game's original phone layout) instead of the rotate screen.
export const allowPortrait = () => {
  portraitOk = true;
  try { localStorage.setItem(PORTRAIT_OK_STORAGE_KEY, '1'); } catch { /* storage disabled: lasts this session */ }
  publish();
};
