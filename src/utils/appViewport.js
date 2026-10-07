// src/utils/appViewport.js
// The visible area of the page as CSS variables on <html> (iOS Safari, plans/ui/safari):
//   --app-height  the visible height in px (visualViewport.height, else innerHeight)
//   --app-vh      one hundredth of it: every vh / dvh in the CSS is rewritten to it at build time
//                 (scripts/postcss-app-viewport.js), and the body is pinned to --app-height
//                 (index.css), so Safari's address bar, tab bar, its compact bottom bar in
//                 landscape and the keyboard never cover the top bar, End Turn or a sheet's bottom.
// It follows visualViewport's resize and scroll, window resize and orientation changes, and puts a
// page that Safari scrolled (focusing a field, a bounce) back to the top: the game never scrolls.

/** The visible height from a window-like object (pure, tested). */
export const visibleHeight = (win) => {
  const vv = win.visualViewport;
  const inner = win.innerHeight || 0;
  // visualViewport also shrinks while pinch-zoomed (scale > 1): then the layout height is the one
  // to keep (the game turns zoom off, but a browser may still allow it).
  if (vv && vv.height > 0 && (!vv.scale || vv.scale <= 1.01)) return Math.round(inner > 0 ? Math.min(vv.height, inner) : vv.height);
  return Math.round(inner);
};

/** Writes the variables now; returns the height written. */
export const applyAppViewport = (win = window) => {
  const h = visibleHeight(win);
  if (!(h > 0)) return 0;
  const style = win.document.documentElement.style;
  if (style.getPropertyValue('--app-height') !== `${h}px`) {
    style.setProperty('--app-height', `${h}px`);
    style.setProperty('--app-vh', `${h / 100}px`);
  }
  // Safari can scroll the layout viewport behind a fixed body (a focused input, a rubber-band):
  // nothing in the game scrolls the page, so put it back.
  if ((win.scrollY || win.pageYOffset || 0) !== 0 || (win.scrollX || win.pageXOffset || 0) !== 0) {
    try { win.scrollTo(0, 0); } catch { /* not scrollable */ }
  }
  return h;
};

let installed = false;
/** Starts following the visible area (once per page). Returns a stop function. */
export const installAppViewport = (win = typeof window === 'undefined' ? null : window) => {
  if (!win || installed) return () => {};
  installed = true;
  let frame = 0;
  const update = () => {
    if (frame) return;
    const raf = win.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
    frame = raf(() => { frame = 0; applyAppViewport(win); });
  };
  applyAppViewport(win);
  const vv = win.visualViewport;
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  win.addEventListener('resize', update);
  win.addEventListener('scroll', update, { passive: true });
  // iOS reports the new size a little after the rotation: measure again once it settles.
  const late = () => { update(); setTimeout(() => applyAppViewport(win), 350); };
  win.addEventListener('orientationchange', late);
  win.addEventListener('pageshow', late);
  win.document.addEventListener('visibilitychange', late);
  return () => {
    installed = false;
    vv?.removeEventListener('resize', update);
    vv?.removeEventListener('scroll', update);
    win.removeEventListener('resize', update);
    win.removeEventListener('scroll', update);
    win.removeEventListener('orientationchange', late);
    win.removeEventListener('pageshow', late);
    win.document.removeEventListener('visibilitychange', late);
  };
};
