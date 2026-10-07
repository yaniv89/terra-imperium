// scripts/ui/start-steps-shots.mjs
// Screenshots of the new-game screen (W01, plans/UI-DESIGN.md section 8: the start in steps) at the
// reference phone screen (844x390 landscape) and a desktop (1280x800), into plans/ui/start-steps/.
// Needs a running dev server (`npx vite --port 5193`) and a Chrome; headless.
//   node scripts/ui/start-steps-shots.mjs [--url http://localhost:5193/terra-imperium/] [--before]
// --before shoots the old one-screen layout (before-<viewport>.png); otherwise every step, the
// generated-world map and a search, plus a check that no step scrolls sideways.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5193/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const BEFORE = process.argv.includes('--before');
const OUT = path.resolve('plans/ui/start-steps');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const noSideScroll = (page) => page.evaluate(() => {
  const bad = [];
  if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push(`page ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
  return bad;
});

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const problems = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${vp.id}: ${e.message}`));
  await page.goto(`${URL_BASE}?generatedWorlds`, { timeout: 180000 });
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await wait(800);
  const shot = async (name) => { await wait(400); await page.screenshot({ path: path.join(OUT, `${name}-${vp.id}.png`) }); console.log('wrote', `${name}-${vp.id}.png`); };
  if (BEFORE) { await shot('before'); await ctx.close(); continue; }
  await click(page.locator('[data-people="egypt"], [data-people="kemet"]').first());
  await shot('after-1-people');
  problems.push(...(await noSideScroll(page)).map((p) => `${vp.id} step 1: ${p}`));
  await page.fill('input[aria-label="Search peoples"]', 'iraq');
  await shot('after-1-search');
  await page.fill('input[aria-label="Search peoples"]', '');
  // Next with the keyboard (Enter outside a field), Back with Escape
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Enter');
  if (await page.getByTestId('start-screen').getAttribute('data-step') !== 'world') problems.push(`${vp.id}: Enter did not go to the world step`);
  await shot('after-2-world');
  problems.push(...(await noSideScroll(page)).map((p) => `${vp.id} step 2: ${p}`));
  await click(page.getByTestId('map-generated'));
  await page.waitForFunction(() => !/Building/.test(document.querySelector('[data-testid="map-preview-status"]')?.textContent || 'Building'), null, { timeout: 120000 })
    .catch(() => problems.push(`${vp.id}: the generated preview did not finish`));
  await shot('after-2-world-generated');
  problems.push(...(await noSideScroll(page)).map((p) => `${vp.id} step 2 generated: ${p}`));
  await click(page.getByTestId('map-earth'));
  await click(page.getByTestId('start-next'));
  await shot('after-3-rules');
  problems.push(...(await noSideScroll(page)).map((p) => `${vp.id} step 3: ${p}`));
  await click(page.getByTestId('start-next'));
  await shot('after-4-summary');
  problems.push(...(await noSideScroll(page)).map((p) => `${vp.id} step 4: ${p}`));
  await page.keyboard.press('Escape');
  const step = await page.getByTestId('start-screen').getAttribute('data-step');
  if (step !== 'rules') problems.push(`${vp.id}: Escape went to ${step}, expected rules`);
  // touch targets on the phone: every button at least 40 px tall (44 for the main ones)
  if (vp.id === 'phone') {
    const small = await page.evaluate(() => [...document.querySelectorAll('[data-testid="start-screen"] button')]
      .filter((b) => b.offsetParent && b.getAttribute('role') !== 'switch' && b.getBoundingClientRect().height < 40)
      .map((b) => `${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)} ${Math.round(b.getBoundingClientRect().height)}px`));
    if (small.length) console.log('small buttons on the rules step:', small.join('; '));
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no problems');
