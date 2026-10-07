// plans/ui/order-target/shot.mjs
// Screenshots of the order target ring (src/battle/render/orderTarget.js) in the sandbox with the
// battle economy on: workers sent to a resource node, then troops sent at an enemy, by real mouse
// clicks (left click selects, right click orders). Start the dev server first:
//   npx vite --port 5199 --strictPort &
//   node plans/ui/order-target/shot.mjs plans/ui/order-target [--w 844 --h 390]
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&autostart&age=bronze`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.waitForTimeout(1500);
// Start the battle (the deploy card closes) and let the workers settle in.
await page.locator('button', { hasText: /^Start$/ }).first().click();
await page.waitForTimeout(2500);

// Screen point (page px) of a ground point in tiles.
const screenOf = (x, z) => page.evaluate(([gx, gz]) => {
  const r = window.__battleRenderer; const c = r.renderer.domElement.getBoundingClientRect();
  const s = r.worldToScreen(gx, gz); return { x: c.left + s.x, y: c.top + s.y };
}, [x, z]);
const save = async (name) => { const f = path.join(outDir, `${name}-${W}x${H}.png`); await page.screenshot({ path: f }); console.log('saved', f); };

// 1. Workers to a resource node.
const eco = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const w = v.squads.find((q) => q.side === 0 && q.classId === 'worker' && q.alive && q.onField);
  let best = null; let bd = Infinity;
  const clear = (n) => !v.squads.some((q) => q.alive && q.onField && (q.x - n.x) ** 2 + (q.y - n.y) ** 2 < (3 * 256) ** 2);
  v.eco.nodes.forEach((n) => { const d = (n.x - w.x) ** 2 + (n.y - w.y) ** 2; if (d > (5 * 256) ** 2 && d < bd && clear(n)) { bd = d; best = n; } });
  r.centerOn((w.x + best.x) / 512, (w.y + best.y) / 512);
  return { w: { x: w.x / 256, z: w.y / 256, idx: w.idx }, n: { x: best.x / 256, z: best.y / 256, i: best.i } };
});
await page.waitForTimeout(400);
let p = await screenOf(eco.w.x, eco.w.z);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
p = await screenOf(eco.n.x, eco.n.z);
console.log('node at', JSON.stringify(p), 'pick', JSON.stringify(await page.evaluate(([x, y]) => { const r = window.__battleRenderer; const c = r.renderer.domElement.getBoundingClientRect(); return r.pick(x - c.left, y - c.top, window.__battleView(), 1.1, { enemyFirst: true }); }, [p.x, p.y])));
await page.mouse.click(p.x, p.y, { button: 'right' });
await page.waitForTimeout(700);
console.log('workers', JSON.stringify(eco), 'orders', JSON.stringify(await page.evaluate(() => window.__battleRenderer.orderTargets)));
await save('workers-to-node');

// 2. Troops at an enemy squad: march the army (not the workers) toward the keep at 3x until an
// enemy squad is in sight near one of ours, then pause and give the order by hand.
await page.evaluate(() => {
  const v = window.__battleView(); const k = v.structures[0];
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: v.squads.filter((q) => q.side === 0 && q.classId !== 'worker' && q.alive).map((q) => q.idx), x: k.x, y: k.y }]);
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '1×'); b?.click(); b?.click();
});
for (let i = 0; i < 200; i++) {
  await page.waitForTimeout(300);
  const near = await page.evaluate(() => {
    const v = window.__battleView();
    const own = v.squads.filter((q) => q.side === 0 && q.classId !== 'worker' && q.alive && q.onField);
    return v.squads.some((f) => f.side === 1 && f.alive && f.onField && f.visible && own.some((q) => (q.x - f.x) ** 2 + (q.y - f.y) ** 2 < (18 * 256) ** 2));
  });
  if (near) break;
}
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Give orders' }).first().click().catch(() => {}); // close the pause sheet
await page.waitForTimeout(300);
const war = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const own = v.squads.filter((q) => q.side === 0 && q.classId !== 'worker' && q.alive && q.onField);
  const foes = v.squads.filter((q) => q.side === 1 && q.alive && q.onField && q.visible);
  const dist = (f) => Math.min(...own.map((q) => (q.x - f.x) ** 2 + (q.y - f.y) ** 2));
  const foe = foes.sort((x, y) => dist(x) - dist(y))[0];
  const t = foe ? { x: foe.x / 256, z: foe.y / 256 } : { x: v.structures[0].x / 256, z: v.structures[0].y / 256 };
  const a = own.sort((p, q) => ((p.x / 256 - t.x) ** 2 + (p.y / 256 - t.z) ** 2) - ((q.x / 256 - t.x) ** 2 + (q.y / 256 - t.z) ** 2))[0];
  const ax = a.x / 256; const az = a.y / 256;
  r.centerOn((ax + t.x) / 2, (az + t.z) / 2);
  return { a: { x: ax, z: az, idx: a.idx }, t, foe: !!foe };
});
await page.waitForTimeout(400);
p = await screenOf(war.a.x, war.a.z);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
p = await screenOf(war.t.x, war.t.z);
await page.mouse.click(p.x, p.y, { button: 'right' });
await page.waitForTimeout(700);
console.log('troops', JSON.stringify(war), 'orders', JSON.stringify(await page.evaluate(() => window.__battleRenderer.orderTargets)));
console.log('drawn', JSON.stringify(await page.evaluate(() => { const r = window.__battleRenderer; const v = window.__battleView(); const q = v.squads[r.orderTargets.at(-1).target.index]; const m = r.soldierMemo.get(r.orderTargets.at(-1).target.index); const e = r.orderRings.instanceMatrix.array; return { memo: m && { n: m.n, x: m.x, z: m.z, cols: m.cols, spacing: m.spacing }, ring: [e[0], e[12], e[13], e[14]], op: r.orderRings.material.opacity, scratch: { ...r.orderScratch, row: null }, rings: r.orderRings.count, dashes: r.orderDashes.count, tick: v.tick, foe: { alive: q.alive, onField: q.onField, visible: q.visible, fled: q.fled }, own: v.squads[r.orderTargets.at(-1).squads[0]].order }; })));
await save('troops-to-enemy');
// The same, zoomed in on the two squads.
await page.evaluate(([x, z]) => { const r = window.__battleRenderer; r.centerOn(x, z); r.zoomBy(1.8); }, [(war.a.x + war.t.x) / 2, (war.a.z + war.t.z) / 2]);
await page.waitForTimeout(400);
await save('troops-to-enemy-zoom');
console.log(errors.length ? `console errors:\n${errors.slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
