// qa-report/harness/example.mjs
// Tiny working example: starts (or reuses) the dev server on port 5180, opens the app on a
// viewport, starts a seeded game as France, plays two turns and screenshots each stage.
// Usage: node qa-report/harness/example.mjs [viewport] [port]
import { ensureServer, openApp } from './qa.mjs';

const viewport = process.argv[2] || 'desktop';
const port = Number(process.argv[3] || 5180);
const server = await ensureServer(port);
const qa = await openApp({ port, viewport, area: 'example' });
try {
  await qa.step('start screen', async () => { await qa.waitForGameOrStart(); await qa.shot('start-screen'); });
  await qa.step('new game France seed 7', async () => {
    await qa.startNewGame({ nation: 'France', seed: 7 });
    qa.note(`layout=${await qa.layout()} state=${JSON.stringify(await qa.getState())}`);
    await qa.shot('game-started');
  });
  await qa.step('two turns', async () => {
    const markers = await qa.endTurns(2);
    qa.note(`turn markers after End Turn: ${markers.join(', ')}`);
    await qa.shot('after-two-turns');
  });
} finally {
  const log = await qa.close();
  console.log(JSON.stringify(log, null, 2));
  await server.stop();
}
