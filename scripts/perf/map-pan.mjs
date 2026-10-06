// scripts/perf/map-pan.mjs
// Map speed in a real browser (plans/rts-world-review.md 5 and 6.6, plans/MASTER-PLAN.md 5.4):
// France, turn 1, the flat map, panned at the zoom levels phase A measured (k 1, 4, 12, 40).
//   step ms     time from one pan step (a mouse move) to the second frame after it (33 ms is the
//               floor at 60 Hz), median and p90 over STEPS steps;
//   fps         frames a second while the map pans a few pixels every frame for two seconds,
//               with the p90 frame time and the longest frame;
//   main ms     main-thread task time per frame of that pan (CDP Performance.getMetrics);
//   settle      the longest main-thread task in the second after a pan stops (rebuilds on settle);
//   draws       WebGL draw calls of the last frame (the WebGL map), or SVG elements (the old map).
// Two profiles: desktop 1600x900, and a phone (844x390, touch, CPU slowed 4x through
// Emulation.setCPUThrottlingRate), the reference screen of CLAUDE.md.
//
//   node scripts/perf/map-pan.mjs [--renderer webgl|svg] [--no-build] [--port 4199]
//        [--profiles desktop,phone] [--zooms 1,4,12,40] [--channel chrome] [--gpu] [--out file.json]
//        [--explored]   start in the explored world (no fog: every nation on the map, the heavy case)
//        [--shots dir]   screenshots of each profile at k 4 and 40
// Builds the mobile bundle (npm run build:mobile, served from www/) unless --no-build. Uses the
// installed Chrome (channel chrome) by default; --gpu asks it for the real GPU instead of
// SwiftShader, which is what a phone has (software WebGL makes every WebGL number pessimistic).
import { execSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const RENDERER = arg('renderer', 'webgl');
const PORT = Number(arg('port', '4199'));
const PROFILES = arg('profiles', 'desktop,phone').split(',');
const ZOOMS = arg('zooms', '1,4,12,40').split(',').map(Number);
const CHANNEL = arg('channel', 'chrome');
const OUT = arg('out', null);
const SHOTS = arg('shots', null);
const EXPLORED = flag('explored'); // the explored world: no fog, every nation drawn (the heavy case)
const STEPS = 24;

if (!flag('no-build')) execSync('npm run build:mobile', { stdio: 'inherit' });
const server = spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const waitForServer = async () => {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('preview server did not start');
};

const PROFILE = {
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, throttle: 1 },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, throttle: 4 }
};

const startGame = async (page) => {
  if (EXPLORED) await page.getByTestId('explored-world').dispatchEvent('click');
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  const buttons = page.locator('[data-people]');
  await buttons.first().dispatchEvent('click');
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  // "Choose your research" opens on turn 1 over the map: "Later" closes it (the screenshots show the map)
  const later = page.locator('[data-testid="research-choice"] button[aria-label="Later"]');
  await later.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await later.isVisible().catch(() => false)) await later.dispatchEvent('click');
};

// In the page: pan by mouse events (d3-zoom listens on the map, then on the window).
const panSteps = async ({ steps, dx }) => {
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const el = document.querySelector('[data-testid="flat-map"]');
  const r = el.getBoundingClientRect();
  let x = r.left + r.width * 0.4; const y = r.top + r.height * 0.55;
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
  await raf(); await raf();
  const times = [];
  for (let i = 0; i < steps; i++) {
    const t0 = performance.now();
    x += (i % 2 ? -dx : dx);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window, buttons: 1 }));
    await raf(); await raf();
    times.push(performance.now() - t0);
  }
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true, view: window, button: 0 }));
  return times;
};
const panContinuous = async ({ ms, dx }) => {
  const el = document.querySelector('[data-testid="flat-map"]');
  const r = el.getBoundingClientRect();
  let x = r.left + r.width * 0.4; const y = r.top + r.height * 0.55;
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
  const frames = [];
  await new Promise((resolve) => {
    let last = performance.now(); const start = last; let dir = 1; let travelled = 0;
    const tick = (now) => {
      frames.push(now - last); last = now;
      if (now - start > ms) { resolve(); return; }
      x += dx * dir; travelled += dx;
      if (travelled > r.width * 0.3) { dir = -dir; travelled = 0; }
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window, buttons: 1 }));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true, view: window, button: 0 }));
  return frames.slice(1);
};

// In the page: the longest main-thread task in the `ms` after a pan stops (the WebGL map rebuilds
// its sprites and lays out the close view once the view settles; the SVG map rebuilds its paths).
const settleTask = async ({ ms }) => {
  const el = document.querySelector('[data-testid="flat-map"]');
  const r = el.getBoundingClientRect();
  let longest = 0;
  const obs = new PerformanceObserver((list) => list.getEntries().forEach((e) => { longest = Math.max(longest, e.duration); }));
  try { obs.observe({ type: 'longtask', buffered: false }); } catch { return null; }
  const x = r.left + r.width * 0.5; const y = r.top + r.height * 0.5;
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x + r.width * 0.3, clientY: y, bubbles: true, cancelable: true, view: window, buttons: 1 }));
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: x + r.width * 0.3, clientY: y, bubbles: true, view: window, button: 0 }));
  await new Promise((res) => setTimeout(res, ms));
  obs.disconnect();
  return longest;
};

const pct = (list, p) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const round = (v) => Math.round(v * 10) / 10;

const run = async () => {
  await waitForServer();
  const args = flag('gpu') ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
  const browser = await chromium.launch({ channel: CHANNEL, headless: true, args });
  const results = [];
  for (const name of PROFILES) {
    const prof = PROFILE[name];
    const context = await browser.newContext({ viewport: prof.viewport, deviceScaleFactor: prof.deviceScaleFactor, isMobile: prof.isMobile, hasTouch: prof.hasTouch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((renderer) => {
      window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true;
      try { localStorage.setItem('terra-imperium-map-mode', 'flat'); localStorage.setItem('terra-imperium-map-renderer', renderer); localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ }
    }, RENDERER);
    // the map's own downloads (raster tiles, land cover, detail manifest): bytes per zoom step
    let mapBytes = 0; let mapFiles = 0;
    page.on('response', async (res) => {
      if (!/\/map\/(tiles|cover)\//.test(res.url())) return;
      try { const body = await res.body(); mapBytes += body.length; mapFiles += 1; } catch { /* aborted */ }
    });
    await page.goto(`http://localhost:${PORT}/`);
    await startGame(page);
    await page.waitForFunction(() => window.__map2DTest?.focus, null, { timeout: 90000 });
    await page.waitForTimeout(2000);
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('webgl2');
      const ext = c?.getExtension('WEBGL_debug_renderer_info');
      return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    if (prof.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.throttle });
    for (const k of ZOOMS) {
      const bytes0 = mapBytes; const files0 = mapFiles;
      await page.evaluate((zoom) => window.__map2DTest.focus(48.85, 2.35, zoom), k);
      await page.waitForTimeout(2500); // settle, tiles, models
      const screenKB = round((mapBytes - bytes0) / 1024); const screenFiles = mapFiles - files0;
      if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${RENDERER}-${EXPLORED ? 'explored-' : ''}${name}-k${k}.png` }); }
      const steps = await page.evaluate(panSteps, { steps: STEPS, dx: 6 });
      await page.waitForTimeout(600);
      const before = await cdp.send('Performance.getMetrics');
      const frames = await page.evaluate(panContinuous, { ms: 2000, dx: 3 });
      const after = await cdp.send('Performance.getMetrics');
      const metric = (m, key) => m.metrics.find((x) => x.name === key)?.value || 0;
      const taskMs = (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000;
      await page.waitForTimeout(400);
      const settle = await page.evaluate(settleTask, { ms: 1200 });
      await page.waitForTimeout(400);
      const draws = await page.evaluate(() => (window.__glMap ? window.__glMap.info().calls : document.querySelectorAll('[data-testid="flat-map"] *').length));
      const total = frames.reduce((a, b) => a + b, 0);
      const row = {
        profile: name, renderer: RENDERER, world: EXPLORED ? 'explored' : 'fog', k,
        stepMedian: round(pct(steps, 0.5)), stepP90: round(pct(steps, 0.9)),
        fps: round((frames.length * 1000) / total), frameP90: round(pct(frames, 0.9)), frameMax: round(Math.max(...frames)),
        mainMsPerFrame: round(taskMs / Math.max(1, frames.length)), settleMs: settle == null ? null : round(settle), draws,
        screenKB, screenFiles
      };
      results.push(row);
      console.log(JSON.stringify(row));
    }
    if (prof.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`${name}: WebGL renderer ${gl}; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await context.close();
  }
  await browser.close();
  console.log('\n| profile | renderer | world | k | step median / p90 ms | pan fps | frame p90 / max ms | main ms per frame | longest task after a pan, ms | draws (GL calls or SVG nodes) | map download on arrival, kB (files) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  results.forEach((r) => console.log(`| ${r.profile} | ${r.renderer} | ${r.world} | ${r.k} | ${r.stepMedian} / ${r.stepP90} | ${r.fps} | ${r.frameP90} / ${r.frameMax} | ${r.mainMsPerFrame} | ${r.settleMs ?? '-'} | ${r.draws} | ${r.screenKB} (${r.screenFiles}) |`));
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
};

try { await run(); } finally { server.kill(); }
