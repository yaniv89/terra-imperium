// .claude/skills/vitest.skills.config.js
// Runs the project skills' helper sims (*.sim.js) with the app's own Vite/React setup, without
// adding them to the normal `npm test` suite (vitest.config.js only includes src/** tests).
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['.claude/skills/**/*.sim.js'],
    testTimeout: 1800000,
    silent: false,
    reporters: ['verbose']
  }
});
