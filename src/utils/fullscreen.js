// src/utils/fullscreen.js
// Full screen for Android browsers and desktops, and the service worker that makes the site
// installable. iPhone has no Fullscreen API (and its home-screen app is already full screen),
// so the offer is hidden there.
import { useEffect, useState } from 'react';

/** True when the page already runs as an installed app or in full screen. */
export const isAlreadyFullscreen = () => {
  try {
    if (document.fullscreenElement) return true;
    const mm = (q) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
    return mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)') || window.navigator.standalone === true;
  } catch { return false; }
};

/** True when a Full screen button makes sense here. */
export const canOfferFullscreen = () => {
  try {
    return typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false && !isAlreadyFullscreen();
  } catch { return false; }
};

/** Enter full screen (address bar hidden), then ask for landscape. Failures are quiet. */
export const enterFullscreen = async () => {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch { return false; }
  try { await window.screen?.orientation?.lock?.('landscape'); } catch { /* not allowed here: fine */ }
  return true;
};

/** Whether to show the button, kept in step with entering and leaving full screen. */
export const useFullscreenOffer = () => {
  const [offer, setOffer] = useState(canOfferFullscreen);
  useEffect(() => {
    const update = () => setOffer(canOfferFullscreen());
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return offer;
};

/** Register the do-nothing service worker, in production builds only (or with ?sw on dev). */
export const registerServiceWorker = () => {
  try {
    if (!('serviceWorker' in navigator)) return;
    const dev = import.meta.env && !import.meta.env.PROD;
    if (dev && !/[?&]sw\b/.test(window.location.search)) return;
    // Right away: the worker caches nothing, so it costs the first load nothing, and the page's own
    // load event can be late on a slow phone.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  } catch { /* an app without a service worker still works */ }
};
