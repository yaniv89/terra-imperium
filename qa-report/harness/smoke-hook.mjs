// qa-report/harness/smoke-hook.mjs
// Checks the dev-hook start path: RESET_GAME with a fixed seed twice gives the same world.
// Usage: node qa-report/harness/smoke-hook.mjs [viewport] [port]
import { ensureServer, openApp } from './qa.mjs';

const viewport = process.argv[2] || 'desktop';
const port = Number(process.argv[3] || 5180);
const server = await ensureServer(port);
const qa = await openApp({ port, viewport, area: 'smoke-hook' });
const fingerprint = (s) => ({ turn: s.turnNumber, seed: s.rngSeed, cities: Object.keys(s.regions).length, units: Object.keys(s.units || {}).length, firstCities: Object.keys(s.regions).slice(0, 5) });
try {
  const a = await qa.step('hook start Japan seed 42', async () => {
    await qa.startNewGame({ via: 'hook', nationId: 'jp', seed: 42 });
    await qa.shot('japan-seed-42');
    return qa.getState(fingerprint);
  });
  const b = await qa.step('hook start again same seed', async () => {
    await qa.startNewGame({ via: 'hook', nationId: 'jp', seed: 42 });
    return qa.getState(fingerprint);
  });
  qa.note(`a=${JSON.stringify(a)}`);
  qa.note(`b=${JSON.stringify(b)}`);
  qa.note(`same=${JSON.stringify(a) === JSON.stringify(b)}`);
  await qa.step('one turn', async () => { qa.note(`marker ${await qa.endTurn()}`); await qa.shot('after-turn'); });
} finally {
  console.log(JSON.stringify({ ...(await qa.close()), notes: qa.notes }, null, 2));
  await server.stop();
}
