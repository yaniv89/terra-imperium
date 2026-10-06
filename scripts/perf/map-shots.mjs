// scripts/perf/map-shots.mjs
// Screenshots of the WebGL map at chosen places and zooms, on the desktop and the 844x390 phone
// profile (the phase F look checks: rivers, mountain chains, level 6 raster, towns and fields).
// Runs against a dev server you start yourself (npx vite --port 5199) or any URL:
//   node scripts/perf/map-shots.mjs --url http://localhost:5199/ --out plans/phase-f2/after
//        [--profiles desktop,phone] [--explored] [--gpu]
//        [--views "alps:46.3,8.5,1|alps:46.3,8.5,4|..."]   name:lat,lng,k (several per name allowed)
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const URL = arg('url', 'http://localhost:5199/');
const OUT = arg('out', 'plans/phase-f2/shots');
const PROFILES = arg('profiles', 'desktop,phone').split(',');
const EXPLORED = flag('explored');
const VIEWS = arg('views', 'paris:48.85,2.35,1|paris:48.85,2.35,4|paris:48.85,2.35,12|paris:48.85,2.35,40').split('|').map((s) => {
  const [name, rest] = s.split(':'); const [lat, lng, k] = rest.split(',').map(Number);
  return { name, lat, lng, k };
});
const PROFILE = {
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

const startGame = async (page) => {
  if (EXPLORED) await page.getByTestId('explored-world').dispatchEvent('click');
  await page.fill('input[placeholder="Search 240 nations..."]', 'France');
  const buttons = page.locator('section', { has: page.getByRole('heading', { name: 'Choose Your Nation' }) }).locator('button');
  await buttons.first().dispatchEvent('click');
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  const later = page.locator('[data-testid="research-choice"] button[aria-label="Later"]');
  await later.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await later.isVisible().catch(() => false)) await later.dispatchEvent('click');
};

const args = flag('gpu') ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
mkdirSync(OUT, { recursive: true });
for (const name of PROFILES) {
  const context = await browser.newContext(PROFILE[name]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true;
    try { localStorage.setItem('terra-imperium-map-mode', 'flat'); localStorage.setItem('terra-imperium-map-renderer', 'webgl'); localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ }
  });
  await page.goto(URL, { timeout: 240000 }); // a dev server's first load bundles on demand
  await startGame(page);
  await page.waitForFunction(() => window.__map2DTest?.focus, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  for (const v of VIEWS) {
    await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(lat, lng, k), v);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${v.name}-${EXPLORED ? 'explored-' : ''}${name}-k${v.k}.png` });
    const info = await page.evaluate(() => { const i = window.__glMap?.info(); return i && { calls: i.calls, raster: i.raster, rivers: i.rivers, terrainSprites: i.terrainSprites }; });
    console.log(name, v.name, v.k, JSON.stringify(info));
  }
  console.log(`${name}: ${errors.length ? errors.slice(0, 5).join(' | ') : 'no page errors'}`);
  await context.close();
}
await browser.close();
