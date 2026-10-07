// scripts/ui/stuck-turn-check.mjs
// The End Turn safety net in a real browser: the turn worker is made silent for one turn (its turn
// messages dropped, as an iPhone has been seen doing), so after 8 s the dock reads "Still working"
// with "Run it here"; a tap runs the turn on the main thread and the year moves on. With
// ?turndebug the turn log shows on screen. Screenshots into --out.
//   node scripts/preview.mjs --mobile --port 4173   (after npm run build:mobile)
//   node scripts/ui/stuck-turn-check.mjs --url http://localhost:4173/ --out plans/ui/safari/after
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { answerBlockers } from '../../e2e/endTurnHelpers.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL = arg('url', 'http://localhost:4173/');
const OUT = arg('out', 'plans/ui/safari/after');
mkdirSync(OUT, { recursive: true });
const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.addInitScript(() => {
  window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true;
  // Drop the second turn message the page sends to a worker: that turn never gets an answer.
  const post = Worker.prototype.postMessage;
  let turns = 0;
  Worker.prototype.postMessage = function (msg, ...rest) {
    if (msg && msg.state && msg.action && ++turns === 2) return undefined;
    return post.call(this, msg, ...rest);
  };
});
await page.goto(`${URL}?turndebug`);
await page.getByTestId('begin-game').waitFor({ timeout: 120000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad');
await page.locator('[data-people]').first().dispatchEvent('click');
await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
const skip = page.getByRole('button', { name: 'Skip' });
await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
await page.getByTestId('end-turn').waitFor({ timeout: 60000 });
const year = () => page.locator('header').getByText(/^-?\d+ (BCE|CE)$/).textContent();
for (let t = 1; t <= 3; t++) {
  await answerBlockers(page);
  const before = await year();
  const t0 = Date.now();
  await page.getByTestId('end-turn').dispatchEvent('click');
  const runHere = page.getByTestId('run-turn-here');
  const done = await Promise.race([
    page.getByTestId('world-moves').waitFor({ state: 'detached', timeout: 60000 }).then(() => 'answered'),
    runHere.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'offered')
  ]);
  if (done === 'offered') {
    await page.screenshot({ path: `${OUT}/stuck-turn-still-working.png` });
    await runHere.dispatchEvent('click');
    await page.getByTestId('world-moves').waitFor({ state: 'detached', timeout: 60000 });
  }
  const after = await year();
  console.log(`turn ${t}: ${done}, ${Date.now() - t0} ms, ${before} -> ${after}`);
}
await page.screenshot({ path: `${OUT}/stuck-turn-after.png` });
console.log(await page.getByTestId('turn-debug-log').textContent());
await browser.close();
