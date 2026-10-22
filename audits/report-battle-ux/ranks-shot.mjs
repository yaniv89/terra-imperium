// audits/report-battle-ux/ranks-shot.mjs
// The report's battle ranks 5 and 6 in a real browser: the Steward button, the Idle regiments chip,
// the control groups (save, select) and the long-press radial, at one size and language.
// Dev server first:  npx vite --port 5199 --strictPort --force
//   node audits/report-battle-ux/ranks-shot.mjs <outDir> [--w 844 --h 390] [--lang he]
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390)); const lang = opt('lang', 'en');
const touch = W <= 1100;
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
fs.mkdirSync(outDir, { recursive: true });
const tag = `${W}x${H}-${lang}`;

const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
await ctx.addInitScript((l) => { try { localStorage.setItem('ti.coach.firstBattle', '1'); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); } catch { /* blocked */ } }, lang);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.waitForTimeout(4000);
const has = async (id) => (await page.getByTestId(id).count()) > 0;
const tap = async (id) => { const b = await page.getByTestId(id).boundingBox(); if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.getByTestId(id).click(); };
const shot = async (name) => { const f = path.join(outDir, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log(`${name}: ${f}`); };
await tap('battle-start');
await page.waitForTimeout(6000);
console.log(`steward ${await has('battle-steward')} pressed=${await page.getByTestId('battle-steward').getAttribute('aria-pressed').catch(() => null)} idleSquads=${await has('battle-idle-squads')}`);
await shot('1-quick');
await tap('battle-select-all');
await page.waitForTimeout(400);
console.log(`groups after select: ${await page.getByTestId('battle-groups').locator('button').count()}`);
await tap('battle-group-1');
await page.waitForTimeout(600);
await shot('2-group-saved');
// The radial: a long touch on a selected squad (CDP touch events: Playwright has no touch hold).
const pt = await page.evaluate(() => {
  const r = window.__battleRenderer; const v = r?.lastView || r?.view;
  const q = (v?.squads || []).find((s) => s.side === 0 && s.alive && s.onField && s.classId !== 'worker');
  return q ? r.worldToScreen(q.x / 256, q.y / 256) : null;
});
if (pt && touch) {
  const cdp = await ctx.newCDPSession(page);
  if (process.env.DEBUG) await page.evaluate(() => { window.__ev = []; ['click', 'pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup'].forEach((t) => window.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.target.dataset?.testid || e.target.tagName) + '@' + Math.round(e.clientX) + ',' + Math.round(e.clientY)), true)); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
  await page.waitForTimeout(900);
  console.log(`radial while held ${await has('battle-radial')} at ${Math.round(pt.x)},${Math.round(pt.y)}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  console.log(`radial ${await has('battle-radial')}`);
  if (process.env.DEBUG) console.log(await page.evaluate(() => window.__ev.join(' ')));
  await shot('3-radial');
} else console.log(`radial skipped (no squad point: ${JSON.stringify(pt)})`);
console.log(errors.length ? `errors:\n${errors.slice(0, 8).join('\n')}` : 'no console errors');
await browser.close();
