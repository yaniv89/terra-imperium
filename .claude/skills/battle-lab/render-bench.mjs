// .claude/skills/battle-lab/render-bench.mjs
// Renderer scale check (plans/MASTER-PLAN.md 6.2, phase C2): opens `?battleSandbox&bench=N&autostart`
// in a real browser on the real GPU at a phone-sized view, starts the battle and, for each camera
// (default zoom, close, far), records triangles and draw calls per frame, frame time (rAF interval
// p50 / p95) and main-thread ms inside BattleRenderer.render (p50 / p95), with and without the CPU
// throttled 4x, plus a screenshot of each camera.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/render-bench.mjs <outDir> [--bench 300] [--w 844 --h 390 --dpr 1]
//        [--browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"] [--warm 12] [--throttle 4]
// Uses the DEV-only hook window.__battleRenderer (TacticalBattleScreen.jsx).
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const bench = Number(opt('bench', 300));
const W = Number(opt('w', 844)); const H = Number(opt('h', 390)); const DPR = Number(opt('dpr', 1));
const warm = Number(opt('warm', 12));
const throttle = Number(opt('throttle', 4));
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&bench=${bench}&autostart`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
const gpu = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
await page.getByTestId('battle-pause').click(); // deployment -> battle
// Time the renderer's own work and every frame.
await page.evaluate(() => {
  const r = window.__battleRenderer;
  const orig = r.render.bind(r);
  window.__rb = { cpu: [], frame: [], tris: [], calls: [], figures: [], squads: [], gl: [] };
  const timed = (obj, name, list) => { const f = obj[name].bind(obj); obj[name] = (...a) => { const t0 = performance.now(); const v = f(...a); window.__rb[list].push(performance.now() - t0); return v; }; };
  timed(r, 'drawSquads', 'squads'); timed(r.renderer, 'render', 'gl');
  r.render = (...a) => {
    const t0 = performance.now(); orig(...a); const t1 = performance.now();
    const s = window.__rb; s.cpu.push(t1 - t0);
    s.tris.push(r.renderer.info.render.triangles); s.calls.push(r.renderer.info.render.calls);
    let n = 0; r.soldierLayers.forEach((l) => { n += l.count; }); s.figures.push(n);
  };
  let last = performance.now();
  const tick = (t) => { window.__rb.frame.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.waitForTimeout(warm * 1000);
const cdp = await page.context().newCDPSession(page);
const sample = async (label, ms = 4000) => {
  await page.evaluate(() => { const s = window.__rb; Object.values(s).forEach((a) => { a.length = 0; }); });
  await page.waitForTimeout(ms);
  return page.evaluate((lab) => {
    const s = window.__rb;
    const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 0; };
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const r = window.__battleRenderer;
    return { label: lab, zoom: Math.round(r.camera.zoom * 100) / 100, dpr: r.dpr, frames: s.frame.length, frameP50: +pct(s.frame, 0.5).toFixed(1), frameP95: +pct(s.frame, 0.95).toFixed(1), cpuP50: +pct(s.cpu, 0.5).toFixed(2), cpuP95: +pct(s.cpu, 0.95).toFixed(2), squadsP95: +pct(s.squads, 0.95).toFixed(2), glP95: +pct(s.gl, 0.95).toFixed(2), trisAvg: Math.round(avg(s.tris)), trisMax: Math.max(0, ...s.tris), calls: Math.round(avg(s.calls)), figures: Math.round(avg(s.figures)) };
  }, label);
};
const cams = [
  { name: 'default', zoom: 1 },
  { name: 'close', zoom: 2.2 },
  { name: 'far', zoom: 0.45 }
];
const results = [];
const centre = () => page.evaluate(() => {
  // Look at the middle of the fighting: the mean of every squad on the field.
  const r = window.__battleRenderer;
  const v = window.__battleView?.() || null;
  let sx = 0; let sz = 0; let n = 0;
  (v?.squads || []).forEach((q) => { if (q.alive && q.onField) { sx += q.x / 256; sz += q.y / 256; n += 1; } });
  if (n) r.centerOn(sx / n, sz / n); else r.centerOn(r.map.w / 2, r.map.h / 2);
});
for (const cam of cams) {
  await page.evaluate((z) => { const r = window.__battleRenderer; r.camera.zoom = z; r.camera.updateProjectionMatrix(); r.centerOn(r.map.w / 2, r.map.h / 2); }, cam.zoom);
  await centre();
  await page.waitForTimeout(500);
  results.push(await sample(`${cam.name}`));
  await page.screenshot({ path: path.join(outDir, `bench${bench}-${cam.name}.png`) });
  if (throttle > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    results.push(await sample(`${cam.name} cpu x${throttle}`));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
}
console.log(`GPU: ${gpu}  view ${W}x${H} dpr ${DPR}  bench ${bench} a side`);
console.table(results);
fs.writeFileSync(path.join(outDir, `bench${bench}-results.json`), JSON.stringify({ gpu, W, H, DPR, bench, results, errors: errors.slice(0, 20) }, null, 2));
if (errors.length) console.log(`console errors (${errors.length}):\n${errors.slice(0, 10).join('\n')}`);
await browser.close();
