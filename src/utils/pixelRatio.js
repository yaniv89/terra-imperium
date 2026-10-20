// src/utils/pixelRatio.js
// The screen's pixel ratio changes without any resize (a browser zoom, the window dragged to
// another screen): a canvas sized once at the old ratio is then drawn blurred or too large for its
// box (H-06). watchPixelRatio calls back on each change.

/**
 * `fn(dpr)` whenever `win.devicePixelRatio` changes. Returns a function that stops watching.
 * (A `(resolution: Xdppx)` query only fires when leaving X, so it is set up again after each change.)
 */
export const watchPixelRatio = (fn, win = typeof window !== 'undefined' ? window : null) => {
  if (!win?.matchMedia) return () => {};
  let mq = null; let stopped = false;
  const stop = () => {
    if (!mq) return;
    if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener?.(onChange);
    mq = null;
  };
  function onChange() {
    if (stopped) return;
    stop();
    listen();
    fn(win.devicePixelRatio || 1);
  }
  function listen() {
    try { mq = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`); } catch { mq = null; return; }
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener?.(onChange);
  }
  listen();
  return () => { stopped = true; stop(); };
};
