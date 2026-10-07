// scripts/ui/map-hud-shots.mjs
// Screenshots of the world map HUD (fog legend, zoom controls, End Turn) at the reference phone
// screen (844x390 landscape) and a desktop (1280x800), for the map HUD cleanup. Needs a running dev
// server (`npx vite --port 5191`) and a Chrome; headless.
//   node scripts/ui/map-hud-shots.mjs --tag before|after [--url http://localhost:5191/terra-imperium/]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5191/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/map-hud-cleanup');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone-844x390', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop-1280x800', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people = 'Akkad') => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
  await wait(2500);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await ctx.newPage();
    await startGame(page);
    const file = path.join(OUT, `${TAG}-${vp.id}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    console.log('wrote', path.relative(process.cwd(), file));
    const toggle = page.getByRole('button', { name: 'Map zoom controls' });
    if (await toggle.count()) {
      await click(toggle);
      await wait(500);
      const open = path.join(OUT, `${TAG}-${vp.id}-zoom-open.png`);
      await page.screenshot({ path: open, timeout: 120000 });
      console.log('wrote', path.relative(process.cwd(), open));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
