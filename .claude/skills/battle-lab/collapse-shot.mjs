// .claude/skills/battle-lab/collapse-shot.mjs
// A building's collapse frame by frame (art-2 lane): opens a city assault in the sandbox (the defender
// sees its whole town), then drawing-side only makes one ring tower, the nearest houses and the keep
// fall (the view the city layer reads says so) and shoots the moment k = 0, 0.35, 0.7 and 1 of
// COLLAPSE_S with the renderer's clock frozen, so a 1.5 s SwiftShader frame cannot skip it.
// Dev server first (npx vite --port 5199 --strictPort), then:
//   node .claude/skills/battle-lab/collapse-shot.mjs <outDir> [prefix]
// URL (default classical medium city, fort 2, you defend), W, H (844 x 390), DPR (2), ZOOM (1.6).
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'collapse';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox&city=medium&age=classical&fort=2';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR || 2), hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('ti.hint.battleControls', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000 });
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.getByTestId('battle-pause').click(); // start the battle (the deploy card goes)
await page.waitForTimeout(8000); // the town and kit files load
const picked = await page.evaluate((zoom) => {
  const r = window.__battleRenderer; const st = r.setup.structures;
  const keepI = st.findIndex((s) => s.kind === 'keep');
  const k = st[keepI];
  const d = (s) => Math.hypot(s.x - k.x, s.y - k.y);
  const tower = st.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'tower').sort((a, b) => d(a.s) - d(b.s))[0];
  const houses = st.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'house' && !s.underHall).sort((a, b) => d(a.s) - d(b.s)).slice(0, 3);
  const fall = new Set([keepI, ...(tower ? [tower.i] : []), ...houses.map((h) => h.i)]);
  window.__fall = false;
  const upd = r.cityLayer.update.bind(r.cityLayer);
  r.cityLayer.update = (view) => upd(window.__fall ? { ...view, structures: view.structures.map((s, i) => (fall.has(i) ? { ...s, alive: false, hp: 0 } : s)) } : view);
  // the renderer's clock, frozen on demand (writes ignored while frozen)
  let t = r.time; window.__frozen = null;
  Object.defineProperty(r, 'time', { get: () => window.__frozen ?? t, set: (v) => { t = v; }, configurable: true });
  r.camera.zoom = Number(zoom); r.camera.updateProjectionMatrix();
  const c = houses[0]?.s || k; r.centerOn((c.x + k.x) / 512, (c.y + k.y) / 512);
  return { keep: keepI, tower: tower?.i, houses: houses.map((h) => h.i), kits: Object.keys(r.cityLayer.kits || {}) };
}, process.env.ZOOM || '1.6');
console.log(JSON.stringify(picked));
await page.waitForTimeout(3000);
await page.screenshot({ path: `${outDir}/${prefix}-standing.jpg`, type: 'jpeg', quality: 85, timeout: 180000 });
const T0 = 1000;
await page.evaluate((t0) => { window.__frozen = t0; window.__fall = true; }, T0);
await page.waitForTimeout(3000); // the layer sees the fall (fell = t0)
for (const k of [0.15, 0.4, 0.7, 1]) {
  await page.evaluate((t) => { window.__frozen = t; }, T0 + k * 1.3);
  await page.waitForTimeout(3500);
  const file = `${outDir}/${prefix}-k${Math.round(k * 100)}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 85, timeout: 180000 });
  console.log(file, await page.evaluate(() => window.__battleRenderer.cityLayer.fell.size));
}
console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no page errors');
await browser.close();
