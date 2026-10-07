// scripts/ui/start-zoom-shots.mjs
// The first view of a game (plans/ui/start-zoom/): a new game, and the same game loaded again (a
// reload: the autosave, no remembered camera), should open close on the player's capital, its
// hexes, borders and town clear. Screenshots at 844x390 (a phone in landscape) and 1280x800 into
// plans/ui/start-zoom/, with the map's zoom and where the capital sits on screen.
// Needs a running dev server (`npx vite --port 5193`) and a Chrome; headless.
//   node scripts/ui/start-zoom-shots.mjs [--url http://localhost:5193/terra-imperium/] [--tag before|after] [--people Israel]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5193/terra-imperium/');
const TAG = arg('--tag', 'after');
const PEOPLE = arg('--people', 'Israel');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/start-zoom');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: 'phone', viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

// Close what sits over the map at the start (the onboarding cards, first prompts).
const clearOverlays = async (page) => {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: /^(Skip|Later|Not now|Let my advisor choose)$/ });
    if (!(await b.first().isVisible().catch(() => false))) break;
    await click(b.first());
    await wait(400);
  }
};

const where = (page) => page.evaluate(async () => {
  const { latLngOfCity } = await import('/terra-imperium/src/components/map/mapCamera.js');
  const t = window.__map2DTest; const s = window.__game?.state;
  const capId = s?.nations?.[s.playerNationId]?.capitalRegionId; const r = s?.regions?.[capId];
  const ll = latLngOfCity(s, capId);
  const p = t && ll && Number.isFinite(ll.lat) ? t.project(ll.lat, ll.lng) : null;
  return { capital: r?.name, screen: p ? { x: Math.round(p.x), y: Math.round(p.y) } : null, k: t ? Number(t.transform().k.toFixed(2)) : null, size: [innerWidth, innerHeight] };
});

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const size of SIZES) {
  const { name, ...opts } = size;
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
  const page = await ctx.newPage();
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', PEOPLE);
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
  await click(page.getByRole('button', { name: /^Begin as/ }));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(1500);
  await clearOverlays(page);
  await wait(4000);
  console.log(`${name} new game:`, JSON.stringify(await where(page)));
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-new.png`) });
  // loading the game: a reload reads the autosave, with no camera remembered
  await page.reload();
  await page.getByTestId('world-top-bar').waitFor({ timeout: 120000 });
  await wait(1500);
  await clearOverlays(page);
  await wait(4000);
  console.log(`${name} loaded:`, JSON.stringify(await where(page)));
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-load.png`) });
  await ctx.close();
}
await browser.close();
