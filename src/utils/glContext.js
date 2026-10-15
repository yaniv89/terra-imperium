// src/utils/glContext.js
// WebGL contexts on a phone (the iPhone crash hunt). A context and its GPU memory live until its
// canvas is collected, which can be long after the screen that drew on it closed; Safari keeps only
// a few live contexts (it drops the oldest, which can be the map's) and counts their memory against
// the page's limit. So a canvas that leaves the page gives its context back at once.

/** Lose the canvas's WebGL context now (frees its GPU memory). Safe on any canvas. */
export const releaseCanvasContext = (canvas) => {
  try {
    const gl = canvas?.getContext?.('webgl2') || canvas?.getContext?.('webgl');
    if (gl && !gl.isContextLost?.()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* nothing to release */ }
};

/**
 * For an effect's cleanup: once the canvas is out of the page (the screen really closed, not
 * React's development re-run of effects, which keeps the canvas), release its context.
 */
export const releaseWhenDetached = (canvas, delay = 0) => {
  if (!canvas) return;
  setTimeout(() => { if (!canvas.isConnected) releaseCanvasContext(canvas); }, delay);
};
