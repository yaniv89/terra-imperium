// scripts/ui/mobile-repro.mjs
// Phone checks for three mobile bugs (plans/ui/fix-mobile/): the start screen's Begin button, the
// map lens list and the camera when a city's Manage sheet opens. Drives a real Chromium as a phone
// held sideways (touch, a phone user agent) at several iPhone sizes and writes screenshots plus a
// JSON line of measurements per size.
//   node scripts/ui/mobile-repro.mjs --url http://localhost:5191/ --out plans/ui/fix-mobile --tag before
// --chrome <path> runs an installed Chrome when Playwright's own browser is not downloaded.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const url = arg('url', 'http://localhost:5191/');
const out = arg('out', 'plans/ui/fix-mobile');
const tag = arg('tag', 'shot');
const chrome = arg('chrome', process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
const sizes = (arg('sizes', '844x390,932x430,852x393,844x340')).split(',').map((s) => s.split('x').map(Number));
const only = arg('only', 'start,lens,manage').split(',');
mkdirSync(out, { recursive: true });

const iphone = devices['iPhone 13 landscape'] || {};
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];

const rect = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; });
// Is the element's centre the topmost thing on screen there (not clipped, not covered)?
const reachable = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2; const y = r.top + r.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  const hit = document.elementFromPoint(x, y);
  return !!hit && (hit === el || el.contains(hit));
});
const mapK = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="flat-map"]');
  const t = el && el.__zoom;
  return t ? { k: +t.k.toFixed(3), x: Math.round(t.x), y: Math.round(t.y) } : null;
});

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ ...iphone, viewport: { width: w, height: h }, screen: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const row = { size: `${w}x${h}` };
  page.on('pageerror', (e) => { row.errors = [...(row.errors || []), String(e).slice(0, 200)]; });
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; });
  await page.goto(url);
  // Begin is on the last step (Ready) only: the start bar's Next is measured on step 1
  const next = page.getByTestId('start-next');
  const begin = page.getByTestId('begin-game');
  await next.waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(500);
  row.layout = await page.evaluate(() => document.documentElement.dataset.layout);
  row.next = { ...(await rect(next)), reachable: await reachable(next) };
  if (only.includes('start')) await page.screenshot({ path: join(out, `${tag}-start-${w}x${h}.png`) });
  if (only.includes('lens') || only.includes('manage')) {
    // start the game the way a player would: Next to Ready, scroll Begin into view if it must, then tap it
    for (let i = 0; i < 3; i++) await next.tap({ timeout: 5000 }).catch(() => next.dispatchEvent('click'));
    await begin.scrollIntoViewIfNeeded().catch(() => {});
    await begin.tap({ timeout: 5000 }).catch(async () => { row.beginTapFailed = true; await begin.dispatchEvent('click'); });
    const skip = page.getByRole('button', { name: 'Skip' });
    await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
    await page.getByTestId('lens-pill').waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);
  }
  if (only.includes('lens')) {
    await page.getByTestId('lens-pill').tap();
    await page.waitForTimeout(300);
    const items = page.locator('[data-lens]');
    const n = await items.count();
    row.lens = [];
    for (let i = 0; i < n; i += 1) {
      const it = items.nth(i);
      await it.scrollIntoViewIfNeeded().catch(() => {});
      row.lens.push({ id: await it.getAttribute('data-lens'), ...(await rect(it)), reachable: await reachable(it) });
    }
    await page.screenshot({ path: join(out, `${tag}-lens-open-${w}x${h}.png`) });
    // pick Supply, then try to get back to Political
    await page.locator('[data-lens="supply"]').dispatchEvent('click');
    await page.waitForTimeout(300);
    const back = page.getByTestId('lens-political');
    row.politicalOneTap = (await back.count()) > 0 && await reachable(back);
    await page.screenshot({ path: join(out, `${tag}-lens-supply-${w}x${h}.png`) });
    await page.getByTestId('lens-pill').tap();
    await page.waitForTimeout(300);
    const pol = page.locator('[data-lens="political"]');
    row.politicalReachableInList = await reachable(pol);
    if ((await pol.count()) && row.politicalReachableInList) await pol.tap();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  if (only.includes('manage')) {
    // clear the way: the lens list and any docked panel (the research picker opens by itself)
    const closeLens = page.getByRole('button', { name: 'Close lenses' });
    if (await closeLens.count()) await closeLens.dispatchEvent('click');
    const later = page.getByRole('button', { name: 'Later' });
    if (await later.count()) await later.first().dispatchEvent('click');
    await page.waitForTimeout(500);
    // zoom in on the capital as a player would (the close view), then open its card and press Manage
    await page.getByRole('button', { name: 'Map zoom controls' }).dispatchEvent('click'); // folded away by default
    const zin = page.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < Number(arg('zoomins', '3')); i += 1) { await zin.dispatchEvent('click'); await page.waitForTimeout(300); }
    await page.waitForTimeout(1000);
    row.kBeforeManage = await mapK(page);
    // the capital's card: the "can build" chip selects it (the same event as tapping its banner)
    const chip = page.getByRole('button', { name: /can build/ }).first();
    if (await chip.count()) await chip.dispatchEvent('click');
    else row.chip = 'no city chip';
    await page.waitForTimeout(1000);
    row.kWithCard = await mapK(page);
    await page.screenshot({ path: join(out, `${tag}-manage-card-${w}x${h}.png`) });
    const manage = page.getByRole('button', { name: /Manage|Open the city/ }).first();
    if (await manage.count()) {
      await manage.dispatchEvent('click');
      await page.waitForTimeout(1500);
      row.kAfterManage = await mapK(page);
      await page.screenshot({ path: join(out, `${tag}-manage-open-${w}x${h}.png`) });
    } else row.manage = 'no Manage button';
  }
  results.push(row);
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
