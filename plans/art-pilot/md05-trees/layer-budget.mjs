// plans/art-pilot/md05-trees/layer-budget.mjs
// Triangles a frame by layer for a forest battle on the phone profile (844x390, device scale 3,
// the real GPU), at the battle's own opening camera and at a few other views. Each layer's share
// is measured by drawing the frame with that layer hidden (renderer.info counts the shadow pass
// too), so the shares add up to what the phone draws.
//   node scripts/build.mjs && node scripts/preview.mjs --port 5203 &
//   node plans/art-pilot/md05-trees/layer-budget.mjs <outDir> <prefix> [extra url params]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'budget';
const extra = process.argv[4] || '';
mkdirSync(outDir, { recursive: true });
const url = `${process.env.BASE || 'http://localhost:5203/terra-imperium/'}?battleSandbox&age=bronze&terrain=forest&perf${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11']
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true });
const page = await ctx.newPage();
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer.vegetation?.trees || window.__battleRenderer.vegetation?.kinds, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);
const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
const report = { url, views: [] };

const measure = () => page.evaluate(() => {
  const r = window.__battleRenderer; const v = r.vegetation;
  const draw = () => { r.renderer.render(r.scene, r.camera); return r.renderer.info.render.triangles; };
  const groups = {
    trees: v?.trees ? [...v.trees.meshes, ...(v.trees.near || [])].map((t) => t.mesh) : ['pine', 'oak'].flatMap((k) => v?.kinds?.[k]?.list || []),
    'rocks and grass': Object.entries(v?.kinds || {}).filter(([k]) => k !== 'pine' && k !== 'oak').flatMap(([, x]) => x.list),
    soldiers: [...r.soldierLayers.values()].flatMap((l) => l.levels),
    terrain: [r.terrain, r.skirt, r.water].filter(Boolean)
  };
  const total = draw();
  const out = { zoom: r.camera.zoom, total, layers: {}, tier: r.soldierTier, vegetationLod: v?.lod ?? null, trees: v?.treeStats?.() ?? null };
  let named = 0;
  Object.entries(groups).forEach(([name, list]) => {
    const was = list.map((m) => m.visible);
    list.forEach((m) => { m.visible = false; });
    out.layers[name] = total - draw();
    named += out.layers[name];
    list.forEach((m, i) => { m.visible = was[i]; });
  });
  out.layers['everything else (buildings, nodes, camp, effects)'] = total - named;
  return out;
});

// the battle's opening camera, untouched
report.views.push({ view: 'opening camera', ...(await measure()) });
await page.screenshot({ path: `${outDir}/${prefix}-opening.jpg`, type: 'jpeg', quality: 86, timeout: 180000 });
// the armies closing in, paused, at the opening zoom: on the army and on the densest wood near it
await tap('battle-pause');
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(Number(process.env.WAIT || 9000));
await tap('battle-pause');
await page.waitForTimeout(800);
await tap('battle-pause-orders');
const spots = await page.evaluate(() => {
  const r = window.__battleRenderer; const { w, h, tiles } = r.map;
  const own = (window.__battleView?.()?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField);
  const ax = own.reduce((a, q) => a + q.x, 0) / Math.max(1, own.length) / 256; const ay = own.reduce((a, q) => a + q.y, 0) / Math.max(1, own.length) / 256;
  let best = null;
  for (let z = 6; z < h - 6; z += 2) for (let x = 6; x < w - 6; x += 2) {
    let n = 0;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) if (tiles[(z + dz) * w + x + dx] === 1) n++;
    if (!best || n > best.n) best = { x, z, n };
  }
  return { army: [ax, ay], densest: [best.x, best.z] };
});
for (const [view, at, zoom] of [['army, zoom 1', spots.army, 1], ['densest wood, zoom 1', spots.densest, 1], ['densest wood, zoom 1.5', spots.densest, 1.5], ['densest wood, zoom 2', spots.densest, 2], ['densest wood, zoom 3', spots.densest, 3], ['army, zoom 3', spots.army, 3]]) {
  await page.evaluate(({ at, zoom }) => { const r = window.__battleRenderer; r.camera.zoom = zoom; r.camera.updateProjectionMatrix(); r.centerOn(at[0], at[1]); r.updateCamera(); }, { at, zoom });
  await page.waitForTimeout(1500);
  report.views.push({ view, ...(await measure()) });
  await page.screenshot({ path: `${outDir}/${prefix}-${view.replace(/[ ,.]+/g, '-')}.jpg`, type: 'jpeg', quality: 86, timeout: 180000 });
}
writeFileSync(`${outDir}/${prefix}-layers.json`, `${JSON.stringify(report, null, 2)}\n`);
report.views.forEach((x) => console.log(`${x.view}: zoom ${x.zoom} total ${Math.round(x.total / 1000)}k  ${Object.entries(x.layers).map(([k, n]) => `${k} ${Math.round(n / 1000)}k`).join(', ')}  tier ${x.tier} vegLod ${x.vegetationLod}${x.trees ? ` trees ${x.trees.drawn}/${x.trees.trees}${x.trees.cost != null ? ` estimate ${Math.round(x.trees.cost / 1000)}k` : ''}` : ''}`));
await ctx.close();
await browser.close();
