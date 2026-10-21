// scripts/ui/diff-u39-shots.mjs
// Touch-emulated check (844x390, hasTouch + isMobile) of circle select (U39) and hold for help (U39),
// plus the touch coach words (U40). Dev server: npx vite --port <free> --strictPort
//   node scripts/ui/diff-u39-shots.mjs --url http://localhost:5341/terra-imperium/
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const base = arg('--url', 'http://localhost:5341/terra-imperium/');
const OUT = path.resolve('plans/game/diff-u39-u40');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok) => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

const browser = await launchBrowser({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const shot = (name) => page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 70 });

// Circle select in a battle: double-tap, then drag a loop around the player's squads.
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { waitUntil: 'domcontentloaded', timeout: 240000 });
await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
await wait(1500);
await shot('1-coach-touch.jpg');
check('coach teaches draw a path first', /draw a path/i.test(await page.getByTestId('battle-coach').innerText().catch(() => '')));
await page.getByTestId('battle-coach-skip').dispatchEvent('click').catch(() => {});
await page.getByTestId('battle-pause').dispatchEvent('click'); await wait(1500); // start
await page.getByTestId('battle-select-mode').dispatchEvent('click'); await wait(300);
const pts = await page.evaluate(() => { const v = window.__battleView(); return v.squads.filter((q) => q.side === 0 && q.onField).map((q) => window.__battleRenderer.worldToScreen(q.x / 256, q.y / 256)); });
const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length; const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
const r = Math.max(40, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 25;
await touch('touchStart', cx + r, cy);
const N = 24;
for (let i = 1; i <= N; i++) { const a = (i / N) * Math.PI * 2; await touch('touchMove', cx + r * Math.cos(a), cy + r * Math.sin(a)); await wait(15); }
await shot('2-circle-drawing.jpg');
await touch('touchEnd'); await wait(500);
check('circle selects the squads it encloses', await page.getByTestId('battle-selection').isVisible().catch(() => false));
await shot('3-circle-selected.jpg');

// Hold for help: the Tech tab, hold a tech card.
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push(e.message));
await page2.goto(base); await page2.evaluate(() => localStorage.clear()); await page2.goto(base);
await page2.locator('[data-people]').first().waitFor({ timeout: 120000 });
await page2.locator('[data-people]').first().dispatchEvent('click');
await page2.getByTestId('start-step-rules').dispatchEvent('click');
await page2.getByTestId('start-step-ready').dispatchEvent('click');
await page2.getByRole('button', { name: /^(Begin as|התחל)/ }).dispatchEvent('click');
const skip = page2.getByRole('button', { name: /^(Skip|דלג)/ });
await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
await page2.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
await wait(1500);
await page2.getByRole('button', { name: /^(Tech|Research|טכנולוגיה|מחקר)/ }).first().dispatchEvent('click').catch(() => {});
const card = page2.locator('[data-help^="tech:"]').first();
await card.waitFor({ timeout: 15000 });
await card.scrollIntoViewIfNeeded();
const box = await card.boundingBox();
const c2 = await ctx.newCDPSession(page2);
const t2 = (type, x, y) => c2.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
// a drag past 10 px must not open help
await t2('touchStart', box.x + 20, box.y + 10); await wait(100); await t2('touchMove', box.x + 20, box.y + 40); await wait(600); await t2('touchEnd');
console.log('sheet after drag', await page2.getByTestId('glossary-sheet').count());
check('a drag does not open help', !(await page2.getByTestId('glossary-sheet').isVisible().catch(() => false)));
await page2.mouse.move(1, 1); await wait(300);
const box2 = await card.boundingBox();
await t2('touchStart', box2.x + 20, box2.y + 10); await wait(700);
check('a hold opens the glossary', await page2.getByTestId('glossary-sheet').isVisible().catch(() => false));
await page2.screenshot({ path: path.join(OUT, '4-hold-help.jpg'), type: 'jpeg', quality: 70 });
await t2('touchEnd');
console.log('page errors', errors);
await browser.close();
process.exit(failed ? 1 : 0);
