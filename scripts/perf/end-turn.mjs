// scripts/perf/end-turn.mjs
// End Turn as the player feels it, in a real browser: a saved game (the turnProfile SAVE_STATE JSON)
// goes into the save slot, the page reloads into it, and End Turn is pressed TURNS times. Per turn:
//   wait     the press to the new turn number on the page (worker turn + transfer + apply + render)
//   settle   the press to the first quiet moment after it (no main-thread task over 50 ms for 300 ms)
//   main     main-thread long-task time in that window (what freezes taps and the map)
//   longest  the longest main-thread task in it
// Phone profile by default (844x390, CPU slowed 4x), desktop with --profile desktop.
//
//   node scripts/perf/end-turn.mjs --state s.json [--turns 5] [--profile phone|desktop] [--no-build]
//        [--port 4211] [--channel chrome] [--out file.json] [--cpuprofile main.cpuprofile] [--trace t.json]
//        [--sheets Empire,Ruler,Cities]  also time opening those rail sheets (tap to the second frame)
// Builds the mobile bundle with VITE_QA_HOOK=1 (window.__game) unless --no-build.
import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const STATE = arg('state', null);
const TURNS = Number(arg('turns', '5'));
const PORT = Number(arg('port', '4211'));
const CHANNEL = arg('channel', null); // the installed Chrome with --channel chrome; Playwright's Chromium by default
const OUT = arg('out', null);
const TRACE = arg('trace', null); // a Chrome trace of the measured turns (chrome://tracing, or the aggregation in the report)
const CPUPROFILE = arg('cpuprofile', null); // a V8 profile of the page's main thread over the measured turns
const PROFILE = {
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, throttle: 1 },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, throttle: 4 }
}[arg('profile', 'phone')];
if (!STATE) throw new Error('--state <turnProfile SAVE_STATE json> is required');

if (!process.argv.includes('--no-build')) execSync('npm run build:mobile', { stdio: 'inherit', env: { ...process.env, VITE_QA_HOOK: '1' } });
const server = spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 150; i++) {
  try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}

const saveText = JSON.stringify({ version: 20, state: JSON.parse(readFileSync(STATE, 'utf8')), savedAt: 0 });
const browser = await launchBrowser(CHANNEL ? { channel: CHANNEL } : {});
const context = await browser.newContext({ viewport: PROFILE.viewport, deviceScaleFactor: PROFILE.deviceScaleFactor, isMobile: PROFILE.isMobile, hasTouch: PROFILE.hasTouch });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.evaluate((text) => { localStorage.clear(); localStorage.setItem('terra-imperium-save-v1', text); }, saveText);
await page.addInitScript(() => {
  window.__longTasks = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
});
await page.goto(`http://localhost:${PORT}/?turndebug`);
await page.waitForFunction(() => window.__game?.state?.turnNumber > 1, null, { timeout: 120000 });
await page.getByTestId('title-continue').click({ timeout: 60000 });
await page.getByTestId('end-turn').waitFor({ timeout: 120000 });
const cdp = await context.newCDPSession(page);
if (PROFILE.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.throttle });
await page.waitForTimeout(Number(arg('warm', '15000'))); // the map's first build, the close view's models and the worker prewarm

const rows = [];
if (TRACE) await browser.startTracing(page, { path: TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink', 'toplevel'] });
if (CPUPROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
for (let i = 0; i < TURNS; i++) {
  // Answer whatever stops a turn (events, peace offers, blockers) through the reducer, then press.
  await page.evaluate(() => {
    const { state, dispatch } = window.__game;
    if (state.pendingPeaceOffer) dispatch({ type: state.pendingPeaceOffer.terms?.length ? 'REJECT_PENDING_PEACE' : 'ACCEPT_PENDING_PEACE' });
    if (state.activeEventId) dispatch({ type: 'RESOLVE_EVENT', payload: { optionIndex: 0 } });
    if (state.pendingDemand) dispatch({ type: 'ANSWER_DEMAND', payload: { accept: false } });
    (state.tributeDemands || []).forEach((d) => dispatch({ type: 'ANSWER_TRIBUTE_DEMAND', payload: { id: d.id, pay: false } }));
    (state.joinOffers || []).forEach((o) => dispatch({ type: 'ANSWER_JOIN_OFFER', payload: { id: o.id, accept: false } }));
    dispatch({ type: 'ADVISOR_PRODUCTION' });
  });
  // Blockers the reducer step left (demands, tribute, joins): press their decline button.
  for (let k = 0; k < 12; k++) {
    await page.waitForTimeout(400);
    const mode = await page.getAttribute('[data-testid="end-turn"]', 'data-mode').catch(() => null);
    if (mode !== 'blocker') break;
    const kind = await page.getAttribute('[data-testid="end-turn"]', 'data-blocker');
    const answer = page.locator('[data-testid$="-decline"]:visible, button[aria-label="Later"]:visible, [data-testid="advisor-build"]:visible').first();
    if (await answer.count()) await answer.click().catch(() => {});
    else await page.click('[data-testid="end-turn"]').catch(() => {});
    console.log('blocker', kind);
  }
  const from = await page.evaluate(() => window.__game.state.turnNumber);
  const r = await page.evaluate(async (fromTurn) => {
    const t0 = performance.now();
    window.__longTasks = [];
    const btn = document.querySelector('[data-testid="end-turn"]');
    if (!btn || btn.dataset.mode === 'blocker') return { error: `End Turn blocked (${btn?.dataset.blocker})` };
    btn.click();
    if (document.querySelector('[data-testid="end-turn"]')?.dataset.armed === '1') document.querySelector('[data-testid="end-turn"]').click(); // the soft confirm
    let wait = null;
    let quietSince = null;
    for (;;) {
      await new Promise((res) => setTimeout(res, 16));
      const now = performance.now();
      if (wait === null && window.__game.state.turnNumber > fromTurn) wait = now - t0;
      if (now - t0 > 60000) return { error: 'timeout', wait };
      if (wait === null) continue;
      const last = window.__longTasks.reduce((m, [s, d]) => Math.max(m, s + d), 0);
      if (now - Math.max(last, t0 + wait) >= 300) { quietSince = Math.max(last, t0 + wait) - t0; break; }
    }
    const tasks = window.__longTasks.filter(([s]) => s >= t0);
    return { wait, settle: quietSince, main: tasks.reduce((a, [, d]) => a + d, 0), longest: tasks.reduce((m, [, d]) => Math.max(m, d), 0) };
  }, from);
  const row = { turn: from, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])) };
  rows.push(row);
  console.log(JSON.stringify(row));
  if (r.error) { await page.screenshot({ path: join(tmpdir(), 'end-turn-error.png') }); console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('data-testid') || b.textContent.trim().slice(0, 30)).join(' | '))); break; }
}
console.log(await page.textContent('[data-testid="turn-debug-log"]').catch(() => ''));
// --sheets Empire,Cities: open each rail sheet and time the tap to the second frame after it
// (task = the main-thread work of that tap), then close it with a second tap.
const sheets = arg('sheets', null);
for (const name of sheets ? sheets.split(',') : []) {
  const btn = page.getByRole('button', { name, exact: true }).first();
  if (!(await btn.count())) { console.log(JSON.stringify({ sheet: name, error: 'no button' })); continue; }
  await page.waitForTimeout(1500);
  const r = await btn.evaluate(async (el) => {
    window.__longTasks = [];
    const t0 = performance.now();
    el.click();
    const raf = () => new Promise((res) => requestAnimationFrame(res));
    await raf(); await raf();
    const open = performance.now() - t0;
    await new Promise((res) => setTimeout(res, 500));
    const tasks = window.__longTasks.filter(([s]) => s >= t0);
    return { open, main: tasks.reduce((a, [, d]) => a + d, 0), longest: tasks.reduce((m, [, d]) => Math.max(m, d), 0) };
  });
  console.log(JSON.stringify({ sheet: name, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])) }));
  await page.waitForTimeout(800);
  await btn.click().catch(() => {});
}
if (TRACE) await browser.stopTracing();
if (CPUPROFILE) writeFileSync(CPUPROFILE, JSON.stringify((await cdp.send('Profiler.stop')).profile));
const med = (k) => { const v = rows.filter((r) => !r.error).map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const summary = { profile: arg('profile', 'phone'), turns: rows.length, wait: med('wait'), settle: med('settle'), main: med('main'), longest: med('longest') };
console.log('MEDIAN', JSON.stringify(summary));
if (OUT) writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 1));
await browser.close();
stop();
