import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/terra-imperium/',
  // The turn and battle workers load the world grid first and the engine after it (dynamic imports),
  // which needs ES module workers (they are created with { type: 'module' }).
  worker: { format: 'es' },
  server: {
    port: 3000,
    // Agent worktrees live under .claude/worktrees (dozens of full copies of the repo): watching
    // them hangs the dev server, so only the project itself is watched.
    watch: { ignored: ['**/.claude/**', '**/docs/**'] }
  },
  // Scan only the app's own entry for dependencies, never the worktrees' or docs/ html files.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    // The 2D icons (src/assets/icons, ~130 files of 1-4 KB) stay separate files: inlined they would
    // add ~190 KB of base64 to the main bundle; as files only the icons on screen load, cached.
    assetsInlineLimit: 0,
    outDir: 'docs',  
    sourcemap: true,
    emptyOutDir: true 
  }
});