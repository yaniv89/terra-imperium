// scripts/battle-phone-bench.mjs
// Phone-emulated battle benchmark (plans/MASTER-PLAN.md 6.2, phase C2): opens the battle sandbox's
// benchmark battle (`?battleSandbox&bench=N&autostart&perf`) in Chromium or Edge as a landscape
// phone (844x390 css px, device pixel ratio 3, touch) and, for each CPU slowdown (CDP
// Emulation.setCPUThrottlingRate) and camera, reads the battle's own perf readout
// (src/battle/render/perfMeter.js): frame time p50/p95, renderer main-thread ms, sim ms per tick
// (timed in the worker), triangles, draw calls and figures drawn. Saves a screenshot per run.
//
// What it does NOT emulate: a phone GPU. The browser draws on this machine's GPU (on the dev
// laptop an Intel UHD iGPU, about a mid phone's GPU or a bit stronger). Throttling slows the
// page's JavaScript (main thread and the sim worker), not the GPU.
//
//   npx vite --port 5199 --strictPort &                       (or point --url at a build)
//   node scripts/battle-phone-bench.mjs [--sizes 300,500] [--throttle 1,4,6] [--out dir]
//        [--browser <chrome or msedge exe>] [--url http://localhost:5199/terra-imperium/]
//        [--warm 10] [--sample 5] [--eco]   (--eco: the battle economy on, phase R1)
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const sizes = opt('sizes', '300,500').split(',').map(Number);
const throttles = opt('throttle', '1,4,6').split(',').map(Number);
const outDir = opt('out', 'phone-bench');
const base = opt('url', process.env.URL || 'http://localhost:5199/terra-imperium/');
const warm = Number(opt('warm', 10));
const sampleS = Number(opt('sample', 5));
const defaultExe = process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined;
const exe = opt('browser', process.env.CHROMIUM || defaultExe);
const cams = [{ name: 'default', zoom: 1 }, { name: 'far', zoom: 0.45 }];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const rows = [];
let gpu = 'unknown';
for (const n of sizes) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?battleSandbox&bench=${n}&autostart&perf${argv.includes('--eco') ? '&eco' : ''}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
  gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  await page.getByTestId('battle-pause').click(); // deployment -> battle
  await page.waitForTimeout(warm * 1000);
  const cdp = await ctx.newCDPSession(page);
  for (const cam of cams) {
    for (const rate of throttles) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.evaluate((z) => {
        // The perf hook exposes no renderer in a production build: zoom by wheel there instead.
        const r = window.__battleRenderer;
        if (r) { r.camera.zoom = z; r.camera.updateProjectionMatrix(); }
      }, cam.zoom);
      await page.waitForTimeout(sampleS * 1000); // the readout covers the last ~120 frames
      const p = await page.evaluate(() => window.__battlePerf);
      await page.screenshot({ path: path.join(outDir, `phone-${n}-${cam.name}-x${rate}.png`) });
      rows.push({
        size: n, camera: cam.name, cpu: `x${rate}`,
        fps: +p.meter.fps.toFixed(1), frameP50: +p.meter.frameP50.toFixed(1), frameP95: +p.meter.frameP95.toFixed(1),
        mainP95: +p.meter.mainP95.toFixed(1), simMean: p.sim ? +p.sim.mean.toFixed(2) : null, simP95: p.sim ? +p.sim.p95.toFixed(2) : null,
        tris: p.diag.triangles, calls: p.diag.drawCalls, figures: p.diag.figures, lod: p.diag.tier, dpr: p.diag.dpr, squads: p.squads
      });
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  if (errors.length) console.log(`${n}: page errors:\n${errors.slice(0, 5).join('\n')}`);
  await ctx.close();
}
await browser.close();
console.log(`GPU: ${gpu}. Phone emulation: 844x390 css px, DPR 3, touch, CPU throttled as listed; the GPU is NOT emulated.`);
console.table(rows);
fs.writeFileSync(path.join(outDir, 'phone-bench.json'), JSON.stringify({ gpu, rows }, null, 2));
