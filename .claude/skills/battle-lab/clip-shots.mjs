// .claude/skills/battle-lab/clip-shots.mjs
// The clip player (I219) in a real browser: opens the battle sandbox (Bronze by default), runs the
// fight at 3x, and at a few moments pauses and shoots close-ups of a worker at his job, the melee, and
// the fallen, at a phone's landscape size. Prints the clip layers (which units play clips), what each
// figure plays, the corpse pool, and failed requests (a 403 on a model means it fell back to the rig).
// Dev server first:  npx vite --port 5221 --strictPort &
//   node .claude/skills/battle-lab/clip-shots.mjs <outDir> [prefix]
// URL=... (default bronze sandbox on 5221), W, H (844 x 390), CHROMIUM (Edge on Windows), SWGL=1 (SwiftShader
// instead of the real GPU, the default), MOMENTS="12,24,36" (seconds of 3x play before each set of shots).
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'clip';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5221/terra-imperium/?battleSandbox&age=bronze';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const moments = (process.env.MOMENTS || '12,24,36').split(',').map(Number);
const browser = await launchBrowser({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = []; const failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().split('/').slice(-2).join('/')}`); });
await page.goto(url, { timeout: 240000 });
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
const layers = await page.evaluate(() => [...window.__battleRenderer.soldierLayers.entries()].map(([k, l]) => `${k}${l.clipSet ? ` clips(${l.clipSet.count})` : ' rig'}`));
console.log(`layers: ${layers.join(', ')}`);
await tap('battle-pause');
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
// attack-move the player's army on the enemy so the lines meet
await page.evaluate(() => {
  const v = window.__battleView?.(); const send = window.__battleOrders;
  if (!v || !send) return;
  const own = v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField && q.classId !== 'worker');
  const foe = v.squads.filter((q) => q.side !== v.playerSide && q.alive && q.onField && q.classId !== 'worker');
  if (!own.length || !foe.length) return;
  const tx = foe.reduce((a, q) => a + q.x, 0) / foe.length; const ty = foe.reduce((a, q) => a + q.y, 0) / foe.length;
  send([{ side: v.playerSide, type: 'attackMove', squads: own.map((q) => q.idx), x: Math.round(tx), y: Math.round(ty) }]);
});
let played = 0;
const shoot = async (tag, pick, zoom) => {
  const where = await page.evaluate(({ pick: p, zoom: z }) => {
    const r = window.__battleRenderer; const v = window.__battleView?.();
    if (!v) return null;
    let sq = null;
    if (p === 'worker') {
      const ws = v.squads.filter((q) => q.classId === 'worker' && q.alive && q.onField && !(q.side !== v.playerSide && q.visible === false));
      sq = ws.find((q) => (q.work & 7) === 2) || ws.find((q) => (q.work & 7) >= 5) || ws[0];
    } else if (p === 'fight') {
      sq = v.squads.find((q) => q.alive && q.onField && q.striking && q.classId !== 'worker' && !(q.side !== v.playerSide && q.visible === false));
    } else if (p === 'fallen') {
      const c = (r.corpses || [])[Math.max(0, (r.corpses || []).length - 1)];
      if (c) { r.camera.zoom = Math.min(r.maxZoom || 5, z); r.camera.updateProjectionMatrix(); r.centerOn(c.x, c.z); r.updateCamera(); return { at: 'corpse', corpses: r.corpses.length }; }
    }
    if (!sq) return null;
    r.camera.zoom = Math.min(r.maxZoom || 5, z); r.camera.updateProjectionMatrix();
    r.centerOn(sq.x / 256, sq.y / 256); r.updateCamera();
    const info = r.squadInfo[sq.idx]; const set = info?.layer?.clipSet;
    const st = info?.clips?.st;
    const clips = st && set ? Array.from({ length: Math.min(6, st.length / 8) }, (_, i) => st[i * 8]) : [];
    return { at: `${sq.classId}#${sq.idx} side ${sq.side} work ${sq.work} striking ${sq.striking}`, clips, corpses: (r.corpses || []).length };
  }, { pick, zoom });
  if (!where) { console.log(`${tag}: nothing to shoot`); return; }
  await page.waitForTimeout(700);
  const d = await page.evaluate(() => window.__battleRenderer.diagnostics());
  const file = `${outDir}/${prefix}-${tag}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout: 180000 });
  console.log(`${file} ${JSON.stringify(where)} drawCalls=${d.drawCalls} tris=${d.triangles} figures=${d.figures} tier=${d.tier}`);
};
for (const t of moments) {
  await page.waitForTimeout(Math.max(0, t - played) * 1000 / 1); played = t;
  await tap('battle-pause'); await page.waitForTimeout(600);
  await tap('battle-pause-orders'); await page.waitForTimeout(300); // the pause sheet away, the field in full
  console.log(`t=${t}s ` + await page.evaluate(() => { const r = window.__battleRenderer; const v = window.__battleView(); return v.squads.filter((q) => r.squadInfo[q.idx]?.layer?.clipSet).map((q) => `${q.classId}${q.idx}:${q.alive ? Math.round(100 * q.strength / q.maxStrength) : 'dead'}%/memo${r.soldierMemo.get(q.idx)?.n ?? '-'}`).join(' ') + ` corpses=${(r.corpses || []).length}`; }));
  await shoot(`${t}s-worker`, 'worker', 4);
  await shoot(`${t}s-fight`, 'fight', 3.5);
  await shoot(`${t}s-fallen`, 'fallen', 4);
  await tap('battle-pause');
}
console.log(`failed requests: ${failed.length ? [...new Set(failed)].join(', ') : 'none'}`);
if (errors.length) console.log(`errors: ${[...new Set(errors)].slice(0, 6).join(' | ')}`);
await browser.close();
