// scripts/perf/memory-soak.mjs
// Memory over a long session in a real browser (the iPhone crash hunt: iOS kills a page that goes
// over its memory limit and the home-screen app reloads it). Production build, phone profile
// (844x390, touch, deviceScaleFactor 3). Loads a late-game save (scripts/perf/save-size.mjs --write),
// presses Continue, then plays turns; between turns the map zooms out, to the strategic view, into
// the close view over the capital and back, so the raster tiles, rivers and the close view's models
// are built and thrown away. Every --every turns, after a forced garbage collection, it prints:
//   heap MB (JS heap used), nodes, listeners (CDP Performance.getMetrics), and from
//   scripts/perf/memoryProbe.js the WebGL contexts, textures, buffers and their MB, canvases, workers.
// A number that keeps rising is a leak.
//
//   node scripts/perf/memory-soak.mjs --save save.json [--turns 30] [--every 5] [--no-build]
//        [--port 4210] [--swiftshader] [--out file.json] [--lat 33 --lng 44]
import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { answerBlockers } from '../../e2e/endTurnHelpers.js';
import { memoryProbe } from './memoryProbe.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const PORT = Number(arg('port', '4210'));
const TURNS = Number(arg('turns', '30'));
const EVERY = Number(arg('every', '5'));
const SAVE = arg('save', null);
const OUT = arg('out', null);
const SNAP = arg('snap', null); // a folder: a heap snapshot at each sample (scripts/perf/heap-diff.mjs compares two)
const AT = [Number(arg('lat', '33.1')), Number(arg('lng', '44.1'))];
if (!SAVE) throw new Error('--save file.json (scripts/perf/save-size.mjs --write)');

if (!flag('no-build')) execSync('npm run build:mobile', { stdio: 'inherit' });
const server = spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 150; i++) {
  try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}

const args = flag('swiftshader') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(memoryProbe);
const save = readFileSync(SAVE, 'utf8');
await page.addInitScript((text) => {
  window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true;
  try {
    if (!sessionStorage.getItem('soak-seeded')) {
      sessionStorage.setItem('soak-seeded', '1');
      localStorage.setItem('terra-imperium-save-v1', text);
      localStorage.setItem('terra-imperium-map-mode', 'flat');
      localStorage.setItem('terra-imperium-minimap-open', '0');
      localStorage.setItem('terra-imperium-meta-v1', JSON.stringify({ unlockedAchievements: [], hasSeenOnboarding: true }));
    }
  } catch { /* none */ }
}, save);
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');

const sample = async (label) => {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(300);
  await cdp.send('HeapProfiler.collectGarbage');
  const m = await cdp.send('Performance.getMetrics');
  const v = (k) => m.metrics.find((x) => x.name === k)?.value || 0;
  const probe = await page.evaluate(() => window.__memProbe.read());
  const row = { label, heapMB: Math.round(v('JSHeapUsedSize') / 1048576 * 10) / 10, nodes: v('Nodes'), listeners: v('JSEventListeners'), ...probe };
  console.log(JSON.stringify(row));
  if (SNAP) {
    const chunks = [];
    const onChunk = (c) => chunks.push(c.chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
    writeFileSync(`${SNAP}/${label.replace(/\W+/g, '-')}.heapsnapshot`, chunks.join(''));
  }
  if (flag('top')) console.log((await page.evaluate(() => window.__memProbe.top(25))).map((t) => `  ${t.MB} MB ${t.w}x${t.h} ${t.kind} ${t.src || ''}`).join('\n'));
  return row;
};

const yearText = () => page.evaluate(() => (document.querySelector('header')?.innerText.match(/-?\d+ (BCE|CE)/) || [''])[0]);
const playTurn = async () => {
  await answerBlockers(page);
  const before = await yearText();
  await page.getByTestId('end-turn').dispatchEvent('click');
  try {
    await page.waitForFunction((y) => (document.querySelector('header')?.innerText.match(/-?\d+ (BCE|CE)/) || [''])[0] !== y, before, { timeout: 90000 });
  } catch {
    const btn = page.getByTestId('end-turn');
    console.log(`turn did not move: end-turn mode ${await btn.getAttribute('data-mode').catch(() => '?')} blocker ${await btn.getAttribute('data-blocker').catch(() => '?')}`);
    await page.keyboard.press('Escape');
  }
  // the turn report and other sheets close (they hold nothing heavy, but keep the map clear)
  await page.keyboard.press('Escape').catch(() => {});
};
const zoomCycle = async () => {
  for (const k of [1, 6, 40, 120, 6, 1]) {
    await page.evaluate(({ at, k: kk }) => window.__map2DTest?.focus(at[0], at[1], kk), { at: AT, k });
    await page.waitForTimeout(1200);
  }
};

const rows = [];
try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId('title-continue').waitFor({ timeout: 120000 });
  rows.push(await sample('title'));
  await page.getByTestId('title-continue').dispatchEvent('click');
  await page.getByTestId('end-turn').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => window.__map2DTest?.focus, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  rows.push(await sample('map'));
  await zoomCycle();
  rows.push(await sample('turn 0 after zooms'));
  for (let t = 1; t <= TURNS; t++) {
    await playTurn();
    await zoomCycle();
    if (t % EVERY === 0) rows.push(await sample(`turn ${t}`));
  }
} finally {
  console.log(`page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 2));
  await browser.close();
  stop();
}
process.exit(0);
