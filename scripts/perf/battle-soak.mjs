// scripts/perf/battle-soak.mjs
// Memory over repeated battles in a real browser (the iPhone crash hunt). Production build, phone
// profile (844x390, touch, deviceScaleFactor 3). Opens the battle sandbox, lets the battle run a
// few seconds, samples (the peak of a battle), switches to Auto (the screen closes) and samples
// again after a garbage collection (what the battle left behind), then fights the next one.
// Prints the same columns as memory-soak.mjs (scripts/perf/memoryProbe.js).
//
//   node scripts/perf/battle-soak.mjs [--battles 10] [--query "city=medium&age=bronze"] [--no-build]
//        [--port 4211] [--swgl] [--out file.json] [--top]
import { execSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { memoryProbe } from './memoryProbe.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const PORT = Number(arg('port', '4211'));
const BATTLES = Number(arg('battles', '10'));
const QUERY = arg('query', 'city=medium&age=bronze');
const OUT = arg('out', null);

if (!flag('no-build')) execSync('npm run build:mobile', { stdio: 'inherit' });
const server = spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 150; i++) {
  try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}
const browser = await launchBrowser({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(memoryProbe);
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');

const sample = async (label, gc = true) => {
  if (gc) { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300); await cdp.send('HeapProfiler.collectGarbage'); }
  const m = await cdp.send('Performance.getMetrics');
  const v = (k) => m.metrics.find((x) => x.name === k)?.value || 0;
  const probe = await page.evaluate(() => window.__memProbe.read());
  const row = { label, heapMB: Math.round(v('JSHeapUsedSize') / 1048576 * 10) / 10, nodes: v('Nodes'), ...probe };
  row.totalMB = Math.round(row.heapMB + row.gpuMB + row.canvasMB + row.bitmapMB);
  console.log(`${label.padEnd(16)} heap ${row.heapMB} MB | GPU ${row.gpuMB} MB (${row.textures} textures, ${row.buffers} buffers) | canvases ${row.canvases} ${row.canvasMB} MB | bitmaps ${row.bitmaps} ${row.bitmapMB} MB | contexts ${row.contexts} (made ${row.contextsMade}) | workers ${row.workers} | total ${row.totalMB} MB`);
  if (flag('top')) console.log((await page.evaluate(() => window.__memProbe.top(12))).map((t) => `    ${t.MB} MB ${t.w}x${t.h} ${t.kind} ${t.src || ''}`).join('\n'));
  return row;
};

const rows = [];
try {
  await page.goto(`http://localhost:${PORT}/?battleSandbox&autostart&${QUERY}`);
  for (let b = 1; b <= BATTLES; b++) {
    if (b > 1) await page.getByRole('button', { name: 'Fight' }).dispatchEvent('click');
    await page.locator('[data-testid="tactical-battle"] canvas').first().waitFor({ timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="battle-loading"]'), null, { timeout: 120000 });
    // start the fight (the battle opens paused at deployment), let it run, then pause and leave on Auto
    await page.getByTestId('battle-start').dispatchEvent('click');
    await page.waitForTimeout(6000);
    rows.push(await sample(`battle ${b} open`, false));
    await page.getByTestId('battle-pause').dispatchEvent('click');
    await page.getByTestId('battle-switch-auto').dispatchEvent('click');
    await page.getByRole('button', { name: 'Fight' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    rows.push(await sample(`battle ${b} closed`));
  }
} finally {
  console.log(`page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 2));
  await browser.close();
  stop();
}
process.exit(0);
