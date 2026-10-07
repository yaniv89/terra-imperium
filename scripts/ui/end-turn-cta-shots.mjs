// scripts/ui/end-turn-cta-shots.mjs
// Screenshots of the End Turn call to action (src/components/ui/TurnDock.jsx over
// src/engine/turnBlockers.js) at the reference phone screen (844x390) and a desktop (1280x800),
// into plans/ui/end-turn-cta/: production needed, research needed, ready, and what a tap opens.
// Needs a running dev server (`npx vite --port 5187`) and a Chrome; headless.
//   node scripts/ui/end-turn-cta-shots.mjs [--url http://localhost:5187/terra-imperium/] [--chrome <path>]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5187/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/end-turn-cta');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
};

// research: a tech id or null; build: true = every city of yours builds a granary, false = nothing.
const setUp = (page, { research, build }) => page.evaluate(({ research, build }) => {
  const s = window.__game.state; const me = s.playerNationId;
  const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me
    ? { ...c, production: { ...(c.production || {}), current: build ? { kind: 'building', category: 'food', tier: 0 } : null, queue: [], progress: build ? 6 : 0 } }
    : c]));
  const r = s.research || {};
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, research: { ...r, current: research === 'any' ? (r.current || Object.keys(r.progress || {})[0] || 'science_cuneiform_records') : research, queue: [], auto: false } } });
}, { research, build });

const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(700);
  await page.screenshot({ path: file });
  console.log('wrote', path.relative(process.cwd(), file), '|', await page.getByTestId('end-turn').getAttribute('aria-label').catch(() => '(no button)'));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e)));
  await startGame(page);
  const later = page.getByRole('button', { name: 'Later' });
  // 1 production needed
  await setUp(page, { research: 'any', build: false });
  await shot(page, '1-production', vp);
  await click(page.getByTestId('end-turn'));
  await page.getByTestId('city-tab-build').waitFor({ timeout: 10000 });
  await shot(page, '1b-production-tapped', vp);
  // close the city sheet and its card
  const close = page.getByRole('button', { name: /^Close/ }).first();
  if (await close.isVisible().catch(() => false)) await click(close);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: null })));
  // 2 research needed (and a city: the badge counts it)
  await setUp(page, { research: null, build: false });
  if (await later.isVisible().catch(() => false)) await click(later);
  await shot(page, '2-research', vp);
  await click(page.getByTestId('end-turn'));
  await page.getByTestId('research-choice').waitFor({ timeout: 10000 });
  await shot(page, '2b-research-tapped', vp);
  // 3 ready
  await setUp(page, { research: 'any', build: true });
  await page.getByTestId('research-choice').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await shot(page, '3-ready', vp);
  await ctx.close();
}
await browser.close();
