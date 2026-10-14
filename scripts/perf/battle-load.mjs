// scripts/perf/battle-load.mjs
// Battle load and startup in a real browser (plans/playtest-audits-item-inventory.md I220).
// Opens the battle sandbox (`/?battleSandbox&autostart`) at 844x390 and times, from navigation start:
//   loadingShown   the sandbox is up and the "Mustering the troops" screen shows (app boot + setup build)
//   modelsReady    the loading screen is gone (unit GLBs fetched and baked, soldier LODs built)
//   workerCreated  the battle worker is created; workerFirstFrame is when its first frame comes back
//   firstFrame     the first frame reaches the page (the worker first frame, handled on the page)
//   paint          the first animation frame after that
// plus the GLB downloads (count, bytes) and the longest main-thread task. Cold = a new browser context
// (empty HTTP cache); warm = a reload in the same context (cache primed, JS state fresh).
//
//   node scripts/perf/battle-load.mjs [--port 5263] [--ages bronze,classical] [--eco both|on|off]
//        [--runs 3] [--throttle 1] [--swgl] [--no-build] [--channel chrome] [--out file.json]
// Builds the mobile bundle (npm run build:mobile, served from www/) unless --no-build, and serves it with
// scripts/preview.mjs: a production build, like the phone. Compare before/after on the same machine.
import { execSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('port', '5263'));
const AGES = arg('ages', 'bronze,classical').split(',');
const ECO = arg('eco', 'both');
const RUNS = Number(arg('runs', '3'));
const THROTTLE = Number(arg('throttle', '1'));
const CHANNEL = arg('channel', 'chrome');
const OUT = arg('out', null);

if (!process.argv.includes('--no-build')) execSync('npm run build:mobile', { stdio: 'inherit' });
const server = spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 150; i++) {
  try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}

// In the page, before anything runs: mark the moments.
const initScript = () => {
  const m = (window.__loadMarks = {});
  const mark = (k) => { if (m[k] === undefined) m[k] = Math.round(performance.now()); };
  const W = window.Worker;
  window.Worker = function Patched(...a) {
    mark('workerCreated');
    const w = new W(...a);
    const post = w.postMessage.bind(w);
    w.postMessage = (msg, ...r) => { if (msg && msg.type === 'start') mark('startPosted'); return post(msg, ...r); };
    w.addEventListener('message', (e) => { if (e.data && e.data.type === 'frame') mark('workerFirstFrame'); });
    return w;
  };
  window.Worker.prototype = W.prototype;
  let longest = 0;
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { longest = Math.max(longest, e.duration); m.longestTask = Math.round(longest); })).observe({ entryTypes: ['longtask'] }); } catch { /* none */ }
  const tick = () => {
    if (document.querySelector('[data-testid="battle-loading"]')) mark('loadingShown');
    else if (m.loadingShown !== undefined) mark('modelsReady');
    if (m.workerFirstFrame !== undefined) mark('firstFrame');
    if (m.firstFrame !== undefined && document.querySelector('canvas')) mark('paint');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const url = (age, eco) => `http://localhost:${PORT}/?battleSandbox&autostart&age=${age}${eco ? '' : '&noeco'}`;

const measure = async (page, age, eco, reload) => {
  if (reload) await page.reload(); else await page.goto(url(age, eco));
  await page.waitForFunction(() => window.__loadMarks && window.__loadMarks.paint !== undefined, null, { timeout: 60000 })
    .catch(async (e) => { throw new Error(`${e.message}; marks ${JSON.stringify(await page.evaluate(() => window.__loadMarks))}; body ${(await page.evaluate(() => document.body.innerText)).slice(0, 200)}`); });
  const marks = await page.evaluate(() => window.__loadMarks);
  const res = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\.glb/.test(e.name)).map((e) => ({ ms: Math.round(e.duration), bytes: e.encodedBodySize, cached: e.transferSize === 0 })));
  return { ...marks, glbCount: res.length, glbKB: Math.round(res.reduce((s, r) => s + r.bytes, 0) / 1024), glbSlowestMs: Math.max(0, ...res.map((r) => r.ms)), glbCached: res.filter((r) => r.cached).length };
};

const browser = await launchBrowser({ channel: CHANNEL });
const out = [];
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
try {
  // prime vite's transform cache so the cold runs time the browser, not the dev server compiling
  { const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }); const p = await ctx.newPage(); await p.addInitScript(initScript); for (let k = 0; k < 4; k++) { try { await measure(p, AGES[0], true, k > 0); break; } catch { /* vite re-optimizes dependencies on first sight: try again */ } } await ctx.close(); }
  for (const age of AGES) for (const eco of ECO === 'both' ? [true, false] : [ECO === 'on']) {
    const runs = { cold: [], warm: [] };
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      if (THROTTLE > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      await page.addInitScript(initScript);
      if (process.env.DEBUG_LOAD) { page.on('console', (c) => console.log('console', c.type(), c.text().slice(0, 200))); page.on('pageerror', (e) => console.log('pageerror', e.message)); }
      runs.cold.push(await measure(page, age, eco, false));
      runs.warm.push(await measure(page, age, eco, true));
      await ctx.close();
    }
    for (const kind of ['cold', 'warm']) {
      const r = runs[kind]; const keys = Object.keys(r[0]);
      const row = { age, eco, kind, ...Object.fromEntries(keys.map((k) => [k, med(r.map((x) => x[k] ?? 0))])) };
      out.push(row);
      console.log(`${age.padEnd(9)} eco ${eco ? 'on ' : 'off'} ${kind}: loadingShown ${row.loadingShown}  modelsReady ${row.modelsReady}  workerCreated ${row.workerCreated}  workerFirstFrame ${row.workerFirstFrame}  paint ${row.paint} ms | glb ${row.glbCount} files ${row.glbKB} KB (slowest ${row.glbSlowestMs} ms, ${row.glbCached} cached) | longest task ${row.longestTask} ms`);
    }
  }
} finally {
  await browser.close();
  stop();
}
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
process.exit(0);
