// U38 map half in a real browser: March bar Path button, a one-finger stroke becomes a tile route.
//   npx vite --port 5238 --strictPort &  then  node audits/diff-u38/map-path-shot.mjs audits/diff-u38
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import path from 'path';
const out = process.argv[2] || '.';
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.env.URL || 'http://localhost:5238/terra-imperium/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror:', e.message.slice(0, 300)); });
await page.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
await page.goto(base); await page.evaluate(() => localStorage.clear()); await page.goto(base);
await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad');
await page.locator('[data-people]').first().dispatchEvent('click');
await page.getByTestId('start-step-ready').dispatchEvent('click');
await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
const skip = page.getByRole('button', { name: 'Skip' });
await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
await wait(3000);
const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
if (await later.first().isVisible().catch(() => false)) await later.first().dispatchEvent('click');
const shot = (n) => page.screenshot({ path: path.join(out, `844x390-${n}.png`) });
const info = await page.evaluate(() => {
  const s = window.__game.state; const u = Object.values(s.units).find((x) => x.ownerId === s.playerNationId && x.classId !== 'settler'); // Stone Age start: no city yet, the start army stands on a tile
  return { cap: s.playerNationId, unit: u.id, tile: u.tile };
});
console.log('start:', JSON.stringify(info));
await page.evaluate((info) => window.dispatchEvent(new CustomEvent('ti:start-march', { detail: { from: info.cap, naval: false, unitIds: [info.unit] } })), info);
await wait(800);
console.log('march bar:', await page.getByTestId('march-bar').count());
await page.getByTestId('march-path-mode').tap();
await wait(300);
console.log('hint:', await page.getByTestId('march-path-hint').count());
// a stroke over land around the capital's centre
const cs = await page.evaluate((cap) => { const s = window.__game.state; const c = s.regions[cap]; const lat = window.__latOf?.(c); return null; }, info.cap);
const box = await page.getByTestId('gl-map').boundingBox();
const cx = box.x + box.width * 0.45; const cy = box.y + box.height * 0.55;
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await touch('touchStart', cx, cy);
for (const [dx, dy] of [[20, 0], [40, -15], [60, -30], [85, -30], [105, -10], [125, 5]]) { await touch('touchMove', cx + dx, cy + dy); await wait(40); }
console.log('stroke svg:', await page.getByTestId('map-draw-path').count());
await shot('4-map-drawing');
await touch('touchEnd');
await wait(800);
console.log('hint gone:', !(await page.getByTestId('march-path-hint').count()), 'plan:', await page.getByTestId('march-line').textContent());
await shot('5-map-planned');
console.log('errors:', errors);
await browser.close();
