// scripts/ui/u1-shots.mjs
// Screenshots of the world screens restyled in phase U1 (plans/UI-DESIGN.md), at the reference
// phone screen (844x390 landscape) and a desktop (1280x800), into plans/phase-u1/.
// Needs a running dev server (`npx vite --port 5181`) and a Chrome; headless.
//   node scripts/ui/u1-shots.mjs [--url http://localhost:5181/terra-imperium/] [--chrome <path>] [--only W02,W05]
// The game is driven through the UI and, for states that take many turns to reach (a war, a first
// contact), through the dev-only window.__game hook (GameContext.jsx) with LOAD_GAME.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5181/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p)));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const OUT = path.resolve('plans/phase-u1');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people = 'Akkad', explored = false) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  if (explored) await click(page.getByTestId('explored-world'));
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // The first research choice sheet: let the advisor pick so it does not cover the map.
  const later = page.getByRole('button', { name: /Later|Not now/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// Change the live game state through the dev hook (LOAD_GAME keeps the reducer's rules).
const patchState = (page, fnSource) => page.evaluate((src) => {
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', src);
  const s = fn(structuredClone(window.__game.state));
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
}, fnSource);

const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(600);
  await page.screenshot({ path: file });
  console.log('wrote', path.relative(process.cwd(), file));
};

const SCREENS = {
  W01: async (page, vp) => {
    await page.goto(URL_BASE);
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL_BASE);
    await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
    await shot(page, 'W01-start', vp);
  },
  W02: async (page, vp) => {
    await startGame(page);
    await shot(page, 'W02-map', vp);
  }
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log(`[${vp.id}] pageerror`, String(e).slice(0, 300)));
    for (const [id, run] of Object.entries(SCREENS)) {
      if (ONLY.length && !ONLY.includes(id)) continue;
      try { await run(page, vp); } catch (e) { console.log(`[${vp.id}] ${id} failed:`, String(e).slice(0, 400)); }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
export { patchState };
