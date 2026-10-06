import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mobile build for Capacitor (plan Phase E): the GitHub Pages build (vite.config.js) serves from
// https://<user>.github.io/terra-imperium/, so it needs base: '/terra-imperium/' baked into every
// asset URL. A native app shell has no such subpath — Capacitor serves the bundled web assets from
// its own local origin root (capacitor://localhost/ on iOS, https://localhost/ on Android), so
// base: '/terra-imperium/' would 404 every asset. This is a separate build (`npm run build:mobile`,
// output to www/) rather than a runtime toggle, so the GitHub Pages deploy is never at risk of
// picking up the wrong base by accident.
export default defineConfig({
  plugins: [react()],
  base: '/',
  // ES module workers, as vite.config.js: the turn and battle workers load the grid, then the engine.
  worker: { format: 'es' },
  build: {
    // The 2D icons (src/assets/icons, ~130 files of 1-4 KB) stay separate files: inlined they would
    // add ~190 KB of base64 to the main bundle; as files only the icons on screen load, cached.
    assetsInlineLimit: 0,
    outDir: 'www',
    sourcemap: true,
    emptyOutDir: true
  }
});
