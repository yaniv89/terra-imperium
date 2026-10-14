// plans/art-pilot/md05-trees/forest-shots.mjs
// Forest battle screenshots for manifest rows MD05 and MD14: the battle sandbox on a production
// build (vite preview), phone landscape 844x390 at device scale 3, the real GPU, at zooms 2, 1 and
// 0.6, with the triangles and draw calls the renderer reports for each frame.
//   node scripts/build.mjs && node scripts/preview.mjs --port 5203 &
//   node plans/art-pilot/md05-trees/forest-shots.mjs <outDir> <prefix> [extra url params]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'shot';
const extra = process.argv[4] || '';
mkdirSync(outDir, { recursive: true });
const url = `${process.env.BASE || 'http://localhost:5203/terra-imperium/'}?battleSandbox&age=bronze&terrain=forest&perf${extra ? `&${extra}` : ''}`;
const zooms = (process.env.ZOOMS || '2,1,0.6').split(',').map(Number);
const browser = await chromium.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11']
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer.vegetation?.kinds || window.__battleRenderer.vegetation?.trees, null, { timeout: 60000 }).catch(() => {});
const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
// let the armies walk into the woods at 3x, then pause
await tap('battle-pause');
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(Number(process.env.WAIT || 9000));
await tap('battle-pause');
await page.waitForTimeout(800);
await tap('battle-pause-orders');
const report = { url, shots: [] };
report.gpu = await page.evaluate(() => { const gl = window.__battleRenderer.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
report.kit = await page.evaluate(() => { const r = window.__battleRenderer; return { terrain: r.setup.terrain, tile: r.setup.tile ?? null, vegetation: r.setup.vegetation ?? null }; });
// two views: the player's army, and the forest spot with the most forest round it near that army
const views = await page.evaluate(() => {
  const r = window.__battleRenderer; const { w, h, tiles } = r.map;
  const own = (window.__battleView?.()?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField);
  const ax = own.reduce((a, q) => a + q.x, 0) / Math.max(1, own.length) / 256; const ay = own.reduce((a, q) => a + q.y, 0) / Math.max(1, own.length) / 256;
  const counts = {}; for (let i = 0; i < tiles.length; i++) counts[tiles[i]] = (counts[tiles[i]] || 0) + 1;
  const forest = Number(new URLSearchParams(location.search).get('forestCode') ?? 1);
  let best = null;
  for (let z = 6; z < h - 6; z += 2) for (let x = 6; x < w - 6; x += 2) {
    let n = 0;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) if (tiles[(z + dz) * w + x + dx] === forest) n++;
    const score = n - Math.hypot(x - ax, z - ay) * 0.6;
    if (!best || score > best.score) best = { x, z, score, n };
  }
  return { army: [ax, ay], woods: [best.x, best.z], forestRound: best.n, size: [w, h], counts };
});
report.views = views;
for (const view of ['army', 'woods']) {
  for (const z of zooms) {
    await page.evaluate(({ z, at }) => {
      const r = window.__battleRenderer;
      r.camera.zoom = Math.min(r.maxZoom || 3, z); r.camera.updateProjectionMatrix();
      r.centerOn(at[0], at[1]); r.updateCamera();
    }, { z, at: views[view] });
    await page.waitForTimeout(1500);
    const d = await page.evaluate(() => { const r = window.__battleRenderer; const x = r.diagnostics(); return { zoom: x.zoom, triangles: x.triangles, drawCalls: x.drawCalls, figures: x.figures, tier: x.tier, vegetationLod: r.vegetation?.lod ?? null, trees: r.vegetation?.treeStats?.() ?? null }; });
    const file = `${outDir}/${prefix}-${view}-zoom${String(z).replace('.', '_')}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: 180000 });
    report.shots.push({ file, view, ...d });
    console.log(`${file} zoom=${d.zoom} triangles=${d.triangles} drawCalls=${d.drawCalls} vegetationLod=${d.vegetationLod}${d.trees ? ` trees=${d.trees.drawn}/${d.trees.trees} meshes=${d.trees.meshes}` : ''}`);
  }
}
report.errors = errors.slice(0, 10);
writeFileSync(`${outDir}/${prefix}-report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ gpu: report.gpu, kit: report.kit, views, errors: report.errors }));
await ctx.close();
await browser.close();
