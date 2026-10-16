// .claude/skills/battle-lab/wood-shot.mjs
// W12 in a real browser: every tree is wood. Opens the sandbox in a forest with the economy on,
// measures the frame (p50/p95 ms, draw calls, triangles) on a fixed camera over the woods, sends
// every laborer of the player to the wood nearest the camp, runs at 3x until trees fall, and saves
// two screenshots: the laborers chopping (with the stumps) and the field zoomed out (the scattered
// nodes). Prints the wood's trees and how many are down, and console errors.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/wood-shot.mjs <outDir> [--w 844 --h 390] [--seconds 60] [--tag new]
//        [--query "&terrain=forest&age=bronze"] [--perf-only]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const seconds = Number(opt('seconds', 60));
const zoom = Number(opt('zoom', 4));
const tag = opt('tag', `${W}x${H}`);
const query = opt('query', '&terrain=forest&age=bronze');
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&autostart&perf${query}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(1500);
// The frame over the woods: the camera on the forest-richest tile band between the bases, default zoom.
await page.evaluate(() => {
  const r = window.__battleRenderer; const { w, h, tiles } = r.setup.map;
  let best = 0; let bx = w / 2; let bz = h / 2;
  for (let z = 6; z < h - 6; z += 3) for (let x = 14; x < w - 14; x += 3) {
    let n = 0; for (let j = -6; j <= 6; j++) for (let i = -10; i <= 10; i++) if (tiles[(z + j) * w + x + i] === 1) n++;
    if (n > best) { best = n; bx = x; bz = z; }
  }
  r.centerOn(bx, bz);
  r.frameTimes && (r.frameTimes.length = 0);
});
await page.waitForTimeout(6000);
const perf = await page.evaluate(() => { const d = window.__battleRenderer.diagnostics(); const m = window.__battlePerf || {}; const r = (v) => (v == null ? null : Math.round(v * 100) / 100); return { frameP50: r(m.meter?.frameP50 ?? m.frameP50), frameP95: r(m.meter?.frameP95 ?? m.frameP95), mainP50: r(m.meter?.mainP50 ?? m.mainP50), mainP95: r(m.meter?.mainP95 ?? m.mainP95), simMean: r(m.sim?.mean), simP95: r(m.sim?.p95), drawCalls: d.drawCalls, triangles: d.triangles, raw: Object.keys(m) }; });
console.log(`PERF ${tag} ${JSON.stringify(perf)}`);
if (argv.includes('--perf-only')) { console.log(errors.length ? `console errors:\n${errors.slice(0, 20).join('\n')}` : 'no console errors'); await browser.close(); process.exit(0); }

// Every laborer of the player to a wood near its camp with six trees or more.
const wood = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const camp = v.eco.buildings.find((b) => b.type === 'camp');
  const woods = v.eco.nodes.filter((n) => n.kind === 'tree' && n.trees >= 6 && !n.spent);
  // one north of the camp first: it is felled from its south edge, so the stumps face the camera
  const key = (n) => ((n.x - camp.x) ** 2 + (n.y - camp.y) ** 2) * (n.y < camp.y - 512 ? 1 : 4);
  woods.sort((a, b) => key(a) - key(b));
  const n = woods[0];
  const workers = v.squads.filter((q) => q.side === 0 && q.classId === 'worker' && q.alive).map((q) => q.idx ?? v.squads.indexOf(q));
  window.__battleOrders([{ side: 0, type: 'gather', squads: workers, node: n.i }]);
  return { i: n.i, trees: n.trees, x: n.x / 256, z: n.y / 256, workers: workers.length, campDist: Math.round(Math.hypot(n.x - camp.x, n.y - camp.y) / 256), woods: v.eco.nodes.filter((x) => x.kind === 'tree').length, nodes: v.eco.nodes.length, r: !!r };
});
wood.zoom = zoom; wood.fieldZoom = Number(opt('field-zoom', 0.9));
console.log(`WOOD ${JSON.stringify(wood)}`);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '1×'); b?.click(); b?.click(); }); // 3x
for (let s = 0; s < seconds; s += 10) {
  await page.waitForTimeout(10000);
  const st = await page.evaluate((i) => { const v = window.__battleView(); const n = v.eco.nodes.find((x) => x.i === i); return { tick: v.tick, wood: v.eco.stock[1], cut: n?.cut, amount: n?.amount, stumps: window.__battleRenderer.treeFelling?.stats?.() }; }, wood.i);
  console.log(`t+${s + 10}s ${JSON.stringify(st)}`);
}
// Keep it running at 1x for the chopping shot (the pose needs the clock), centred on the cut.
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^3×$/.test(x.textContent.trim())); b?.click(); });
await page.getByRole('button', { name: 'Skip' }).click({ timeout: 2000 }).catch(() => {}); // the first-battle hint
const shot = async (name, fn) => {
  await page.evaluate(fn, wood);
  await page.waitForTimeout(900);
  const file = path.join(outDir, `${name}-${tag}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
};
await shot('chop', (wd) => { const r = window.__battleRenderer; const v = window.__battleView(); const n = v.eco.nodes.find((x) => x.i === wd.i); r.zoomBy(wd.zoom); r.centerOn(n.x / 256, n.y / 256); });
await shot('field', (wd) => { const r = window.__battleRenderer; r.zoomBy(wd.fieldZoom / wd.zoom); r.centerOn(r.setup.map.w / 2, r.setup.map.h / 2); });
console.log(errors.length ? `console errors:\n${errors.slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
