// src/index.jsx
// Application entry point. `?battleSandbox` opens the tactical battle sandbox instead of the game
// and `?tileViewer` the world grid viewer (both lazy-loaded, so the normal game never downloads
// them). `?audiodebug` adds the audio readout (context state, what plays) over the game.

//
// The world grid is fetched first (src/data/geo/tiles.js, a 1.7 MB binary instead of an 8.2 MB
// JSON in this bundle); the app itself is imported only once it is in, because the engine's
// modules read the grid as they load.
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './fonts';
import './index.css';
import { lazyWithReload, installStaleChunkReload } from './utils/lazyWithReload';
import { installAppViewport } from './utils/appViewport';
import { loadWorld, bootWorldSpec, rememberWorldSpec } from './worldgen/worldLoader';

installStaleChunkReload();
// The visible area as --app-height before anything draws (iOS Safari bars; index.css).
installAppViewport();
const BattleSandbox = lazyWithReload(() => import('./components/battle/BattleSandbox'));
const TileViewer = lazyWithReload(() => import('./components/map/TileViewer'));
const WorldLab = lazyWithReload(() => import('./components/map/WorldLab'));
const params = new URLSearchParams(window.location.search);
const isSandbox = params.has('battleSandbox');
const isTileViewer = params.has('tileViewer');
const isWorldLab = params.has('worldLab'); // the world generator's debug page (WorldLab.jsx)

// A generated world is built (or read from the IndexedDB cache) before the app loads, with a
// plain progress line in the page meanwhile (plans/MAP-VARIATIONS-PLAN.md 3.1).
const showProgress = (f, stage) => {
  const el = document.getElementById('root');
  if (el && !el.dataset.app) el.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#10141a;color:#c9c2b0;font:14px system-ui" data-testid="world-progress">Building the world: ${stage} ${Math.round(f * 100)}%</div>`;
};

const start = async () => {
  try {
    await loadWorld(bootWorldSpec(), { onProgress: showProgress });
  } catch (e) {
    // A generated world that cannot be built here: say so and offer the real Earth.
    console.error('The world could not be built', e);
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#10141a;color:#ece5d3;font:14px system-ui;padding:16px;text-align:center" data-testid="world-error">The world of the last game could not be built on this device.<button id="back-to-earth" style="min-height:44px;padding:0 16px;border-radius:8px;background:#232c38;color:#ece5d3;border:1px solid #33404f">Back to the real Earth</button></div>';
      document.getElementById('back-to-earth')?.addEventListener('click', () => { rememberWorldSpec({ kind: 'earth' }); window.location.reload(); });
    }
    return;
  }
  const rootEl = document.getElementById('root');
  if (rootEl) { rootEl.dataset.app = '1'; rootEl.innerHTML = ''; }
  const { default: App } = await import('./App');
  // Create root and render app
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      {isSandbox
        ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><BattleSandbox /></Suspense>
        : isTileViewer
          ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><TileViewer /></Suspense>
          : isWorldLab
            ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><WorldLab /></Suspense>
            : <App />}
    </React.StrictMode>
  );
  // `?audiodebug`: the audio readout (src/components/AudioDebug.jsx) in its own root, over the game.
  if (params.has('audiodebug')) {
    const { default: AudioDebug } = await import('./components/AudioDebug');
    const el = document.createElement('div');
    document.body.appendChild(el);
    ReactDOM.createRoot(el).render(<AudioDebug />);
  }
};
start();
