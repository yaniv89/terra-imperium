// src/index.jsx
// Application entry point. `?battleSandbox` opens the tactical battle sandbox instead of the game
// and `?tileViewer` the world grid viewer (both lazy-loaded, so the normal game never downloads
// them).

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { lazyWithReload, installStaleChunkReload } from './utils/lazyWithReload';

installStaleChunkReload();
const BattleSandbox = lazyWithReload(() => import('./components/battle/BattleSandbox'));
const TileViewer = lazyWithReload(() => import('./components/map/TileViewer'));
const params = new URLSearchParams(window.location.search);
const isSandbox = params.has('battleSandbox');
const isTileViewer = params.has('tileViewer');

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
