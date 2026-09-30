// src/utils/lazyWithReload.js
// A deploy replaces every hashed chunk (docs/ is rebuilt with emptyOutDir), so a tab that loaded the
// game BEFORE the deploy still asks for the old file names the first time it opens a lazily-loaded
// screen (the tactical battle, the globe) — and gets a 404: "Failed to fetch dynamically imported
// module .../TacticalBattleHost-<old hash>.js". The fix is what the player did by hand: reload, which
// fetches the new index.html and the new chunk names. The game state is saved locally, so a reload
// resumes right where it was (a started battle included). Guarded so a genuinely missing file can't
// reload-loop: at most one automatic reload per 30 seconds.
import { lazy } from 'react';

const KEY = 'terra-imperium-chunk-reload-at';

export const isChunkLoadError = (err) => /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk .* failed/i
  .test(String(err?.message || err || ''));

// Reload once to pick up the new build. Returns false (and does nothing) if we just did.
export const reloadForNewVersion = () => {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  window.location.reload();
  return true;
};

// React.lazy that survives a deploy: a stale-chunk failure reloads the page instead of crashing.
export const lazyWithReload = (factory) => lazy(() => factory().catch((err) => {
  if (isChunkLoadError(err) && reloadForNewVersion()) return new Promise(() => {}); // the page is reloading
  throw err;
}));

// Vite's own signal for a failed preload of a chunk's JS/CSS dependencies.
export const installStaleChunkReload = () => {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
};
