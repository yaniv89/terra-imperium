// scripts/ui/city-build-shots.mjs
// BUILD-01: the City Build tab on small phones (844x390, 844x340, 667x375). Checks that the queue
// bar does not cover the advice or the rows (the first build row starts below the bar), that the
// long-build advice is one line until "More", and screenshots into plans/ui/city-build/.
// Needs a dev server of THIS checkout (`npx vite --port 5187`) and Chrome, on the real GPU.
//   node scripts/ui/city-build-shots.mjs [--url http://localhost:5187/terra-imperium/] [--chrome <path>]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5187/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/city-build');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[844, 390], [844, 340], [667, 375]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };
const box = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'] });
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // Nothing in production, so End Turn opens the Build tab.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { ...(c.production || {}), current: null, queue: [], progress: 0 } } : c]));
    const r = s.research || {};
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, research: { ...r, current: r.current || Object.keys(r.progress || {})[0] || 'science_cuneiform_records', queue: [], auto: false } } });
  });
  await click(page.getByTestId('end-turn'));
  await page.getByTestId('city-tab-build').waitFor({ timeout: 10000 });
  await wait(600);
  // Queue three things so the queue is long, then open it.
  for (let i = 0; i < 3; i += 1) { const b = page.getByTestId('queue-item').nth(i); if (await b.isEnabled().catch(() => false)) { await click(b); await wait(200); } }
  const tag = `${w}x${h}`;
  const bar = page.getByTestId('city-queue-bar');
  await bar.waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, `${tag}-closed.png`) });
  await click(page.getByTestId('city-queue-toggle'));
  await wait(300);
  const bb = await box(bar);
  check(`${tag} queue bar stays one line high when the queue opens`, bb.height <= 80, JSON.stringify(bb));
  await page.screenshot({ path: path.join(OUT, `${tag}-queue-open.png`) });
  await click(page.getByTestId('city-queue-toggle'));
  const hint = page.getByTestId('long-build-hint');
  if (await hint.count()) {
    const hb = await box(hint);
    check(`${tag} the advice is one line until More`, hb.height <= 60, JSON.stringify(hb));
    await click(page.getByTestId('long-build-more'));
    await wait(200);
    await page.screenshot({ path: path.join(OUT, `${tag}-advice-open.png`) });
    await click(page.getByTestId('long-build-more'));
  } else console.log(`note ${tag}: no long-build advice in this city`);
  // The scroller: no build row sits under the bar once scrolled to the top.
  const covered = await page.evaluate(() => {
    const barEl = document.querySelector('[data-testid="city-queue-bar"]'); const row = document.querySelector('[data-testid="build-row"]');
    if (!barEl || !row) return null;
    const sc = barEl.parentElement; let el = sc; while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (el) el.scrollTop = 0;
    return { bar: barEl.getBoundingClientRect().bottom, row: row.getBoundingClientRect().top };
  });
  check(`${tag} the first row starts below the queue bar`, !covered || covered.row >= covered.bar - 1, JSON.stringify(covered));
  await page.screenshot({ path: path.join(OUT, `${tag}-top.png`) });
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
