// src/index.jsx
// Application entry point. `?battleSandbox` opens the tactical battle sandbox instead of the game
// and `?tileViewer` the world grid viewer (both lazy-loaded, so the normal game never downloads
// them).

//
// The world grid is fetched first (src/data/geo/tiles.js, a 1.7 MB binary instead of an 8.2 MB
// JSON in this bundle); the app itself is imported only once it is in, because the engine's
// modules read the grid as they load.
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './fonts';
import './index.css';
import { lazyWithReload, installStaleChunkReload } from './utils/lazyWithReload';
import { loadTiles } from './data/geo/tiles';

installStaleChunkReload();
const BattleSandbox = lazyWithReload(() => import('./components/battle/BattleSandbox'));
const TileViewer = lazyWithReload(() => import('./components/map/TileViewer'));
const params = new URLSearchParams(window.location.search);
const isSandbox = params.has('battleSandbox');
const isTileViewer = params.has('tileViewer');

const start = async () => {
  await loadTiles();
  const { default: App } = await import('./App');
  // Create root and render app
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      {isSandbox
        ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><BattleSandbox /></Suspense>
        : isTileViewer
          ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><TileViewer /></Suspense>
          : <App />}
    </React.StrictMode>
  );
};
start();
