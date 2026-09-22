import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // scripts/**/*.test.mjs: build-tooling tests (e.g. the Supabase Edge Function's bundling
    // step) that test a script under scripts/, not app source — kept alongside their target
    // rather than moved into src/.
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs']
  }
});
