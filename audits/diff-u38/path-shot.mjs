// U38 in a real browser: Path button, one-finger drag draws a route, the squad walks its waypoints.
//   npx vite --port 5238 --strictPort &  then  node audits/diff-u38/path-shot.mjs audits/diff-u38
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import path from 'path';
const out = process.argv[2] || '.';
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.env.URL || 'http://localhost:5238/terra-imperium/';
const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror:', e.message.slice(0,300)); });
await page.on('console', (m) => m.type()==='error' && console.log('console:', m.text().slice(0,600)));
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 40000 }).catch(async (e) => { await page.screenshot({ path: path.join(out, 'fail.png') }); throw e; });
await page.waitForTimeout(2000);
const press = (id) => page.getByTestId(id).first().tap();
const shot = (n) => page.screenshot({ path: path.join(out, `844x390-${n}.png`) });
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
// skip the coach if it is up, start
for (let i = 0; i < 4 && await page.getByTestId('battle-coach-next').count(); i++) await press('battle-coach-next');
await press('battle-pause'); await page.waitForTimeout(800);
const info = await page.evaluate(() => { const v = window.__battleView(); const r = window.__battleRenderer;
  const q = v.squads.filter((s) => s.side === 0 && s.alive && s.onField && s.classId !== 'worker')[0];
  r.centerOn(q.x / 256, q.y / 256); r.updateCamera(); window.__pi = q.idx; return { idx: q.idx, x: q.x, y: q.y, s: r.worldToScreen(q.x / 256, q.y / 256, 0) }; });
await page.touchscreen.tap(info.s.x, info.s.y); await page.waitForTimeout(400);
await shot('0-selected');
console.log('path button:', await page.getByTestId('battle-path-mode').count());
await press('battle-path-mode');
console.log('banner:', await page.getByTestId('battle-path-mode-banner').count());
const { x, y } = info.s;
const pts = [[x + 60, y], [x + 120, y - 40], [x + 180, y - 40], [x + 240, y + 30], [x + 300, y + 30]];
await touch('touchStart', x + 20, y);
for (const [px, py] of pts) { await touch('touchMove', px, py); await page.waitForTimeout(40); }
console.log('drawn polyline:', await page.getByTestId('battle-draw-path').count());
await shot('1-drawing');
await touch('touchEnd');
await page.waitForTimeout(300);
console.log('mode left:', !(await page.getByTestId('battle-path-mode-banner').count()));
await shot('2-ordered');
const orders = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(1500); orders.push(await page.evaluate(() => { const o = window.__battleView().squads.filter((s) => s.side === 0 && s.alive).filter((s) => s.idx === window.__pi).map((s) => [s.x, s.y]); return o[0]; })); }
console.log('squad0 track:', JSON.stringify(orders));
await shot('3-walked');
console.log('errors:', errors);
await browser.close();
