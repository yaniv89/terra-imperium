// src/index.jsx
// Application entry point. `?battleSandbox` opens the tactical battle sandbox instead of the game
// (lazy-loaded, so the normal game never downloads it).

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { lazyWithReload, installStaleChunkReload } from './utils/lazyWithReload';

installStaleChunkReload();
const BattleSandbox = lazyWithReload(() => import('./components/battle/BattleSandbox'));
const isSandbox = new URLSearchParams(window.location.search).has('battleSandbox');

// Create root and render app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isSandbox
      ? <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><BattleSandbox /></Suspense>
      : <App />}
  </React.StrictMode>
);
