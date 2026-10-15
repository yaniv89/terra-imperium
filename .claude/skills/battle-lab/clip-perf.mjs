// .claude/skills/battle-lab/clip-perf.mjs
// Frame cost of the clip player (I219), before / after on the same build: each scenario runs once
// with clips and once with `&noclips` (every unit on the procedural rig, as before clips), interleaved.
// Opens the sandbox at 844 x 390, starts the fight at 3x with the armies attack-moving, waits, then
// samples for a few seconds: frame p50 / p95 (ms), the renderer's own ms a frame (render()), draw
// calls, triangles, figures, corpses. Dev server first (npx vite --port 5221 --strictPort &).
//   node .claude/skills/battle-lab/clip-perf.mjs [--swgl] [--scenes default,forest] [--runs 2]
import { browserMode, launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const gpu = browserMode() === 'gpu';
const base = process.env.URL || 'http://localhost:5221/terra-imperium/?battleSandbox';
const scenes = arg('scenes', 'default,forest').split(',');
const runs = Number(arg('runs', 1));
const warm = Number(arg('warm', 14)); const sample = Number(arg('sample', 8));
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await launchBrowser({ executablePath: exe, args: gpu ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [] });

const measure = async (url, off) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  if (off) await page.addInitScript(() => { window.__noClips = true; });
  await page.goto(url, { timeout: 240000 });
  await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
  await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
  const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
  await page.waitForTimeout(1000);
  await tap('battle-pause');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
  await page.evaluate(() => {
    const v = window.__battleView?.(); const send = window.__battleOrders;
    const own = v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField && q.classId !== 'worker');
    const foe = v.squads.filter((q) => q.side !== v.playerSide && q.alive && q.onField && q.classId !== 'worker');
    if (own.length && foe.length) send([{ side: v.playerSide, type: 'attackMove', squads: own.map((q) => q.idx), x: Math.round(foe.reduce((a, q) => a + q.x, 0) / foe.length), y: Math.round(foe.reduce((a, q) => a + q.y, 0) / foe.length) }]);
  });
  await page.waitForTimeout(warm * 1000);
  // follow the fight at the phone's default zoom, time render() itself
  const out = await page.evaluate(async (secs) => {
    const r = window.__battleRenderer;
    const v = window.__battleView();
    const own = v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField && q.classId !== 'worker');
    if (own.length) { r.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / 256, own.reduce((a, q) => a + q.y, 0) / own.length / 256); r.updateCamera(); }
    const orig = r.render.bind(r); const ms = [];
    r.render = (...a) => { const t = performance.now(); orig(...a); ms.push(performance.now() - t); };
    r.frameTimes.length = 0;
    const samples = [];
    for (let s = 0; s < secs; s++) { await new Promise((res) => setTimeout(res, 1000)); const d = r.diagnostics(); samples.push(d); }
    r.render = orig;
    const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };
    const mean = (k) => samples.reduce((a, d) => a + (d[k] || 0), 0) / samples.length;
    const clipLayers = [...r.soldierLayers.entries()].filter(([, l]) => l.clipSet).map(([k]) => k);
    return { frameP50: q(r.frameTimes, 0.5), frameP95: q(r.frameTimes, 0.95), renderP50: q(ms, 0.5), renderP95: q(ms, 0.95), drawCalls: Math.round(mean('drawCalls')), triangles: Math.round(mean('triangles')), figures: Math.round(mean('figures')), tier: samples.at(-1).tier, corpses: (r.corpses || []).length, clipLayers };
  }, sample);
  await ctx.close();
  return out;
};

const f = (x) => (typeof x === 'number' ? x.toFixed(1) : x);
for (let k = 0; k < runs; k++) {
  for (const scene of scenes) {
    const url = scene === 'default' ? base : `${base}&terrain=${scene}`;
    for (const mode of ['noclips', 'clips']) {
      const r = await measure(url, mode === 'noclips');
      console.log(`${gpu ? 'gpu' : 'swiftshader'} ${scene} ${mode.padEnd(7)} frame p50 ${f(r.frameP50)} p95 ${f(r.frameP95)} | render() p50 ${f(r.renderP50)} p95 ${f(r.renderP95)} ms | draws ${r.drawCalls} tris ${r.triangles} figures ${r.figures} tier ${r.tier} corpses ${r.corpses} | clip layers: ${r.clipLayers.join(' ') || 'none'}`);
    }
  }
}
await browser.close();
