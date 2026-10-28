// .claude/skills/battle-lab/shot-fx.mjs
// Projectiles, impacts and the minimap in a real browser (art-2 lane). SwiftShader draws a frame in
// about 1.5 s, longer than a shot's whole flight, so this caps the effects' clock at 1/20 s a frame:
// every shot fired since the last frame shows early in its flight. Opens the sandbox with the minimap
// on, attack-moves the player's army on the enemy at 3x, and at each moment pauses and saves the
// field centred on a shooting squad (one jpg) and the minimap (a crop).
// Dev server first (npx vite --port 5199 --strictPort), then:
//   node .claude/skills/battle-lab/shot-fx.mjs <outDir> [prefix]
// URL (default the archers duel, Bronze), W, H (844 x 390), DPR (2), MOMENTS ("10,18"), ZOOM (unset: the default view).
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'fx';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox&age=bronze&attacker=archers&defender=archers';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const moments = (process.env.MOMENTS || '10,18').split(',').map(Number);
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR || 2), hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ti.battle.minimap', '1'); localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('ti.hint.battleControls', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { timeout: 240000 });
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 120000 });
await page.evaluate(() => {
  const r = window.__battleRenderer; const draw = r.drawFx.bind(r);
  r.drawFx = (dt) => draw(Math.min(dt, 0.05)); // the effects' clock, see the header
});
const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
await tap('battle-pause');
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.evaluate(() => {
  const v = window.__battleView?.(); const send = window.__battleOrders;
  const own = v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField && q.classId !== 'worker');
  const foe = v.squads.filter((q) => q.side !== v.playerSide && q.alive && q.onField && q.classId !== 'worker');
  if (!own.length || !foe.length) return;
  const tx = foe.reduce((a, q) => a + q.x, 0) / foe.length; const ty = foe.reduce((a, q) => a + q.y, 0) / foe.length;
  send([{ side: v.playerSide, type: 'attackMove', squads: own.map((q) => q.idx), x: Math.round(tx), y: Math.round(ty) }]);
});
let played = 0;
for (const t of moments) {
  await page.waitForTimeout(Math.max(0, t - played) * 1000); played = t;
  // centre on the latest shot's middle (or the fight) while it still runs, then pause
  const at = await page.evaluate((zoom) => {
    const r = window.__battleRenderer; const v = window.__battleView();
    const shot = [...r.fx].reverse().find((f) => f.kind === 'tracer');
    if (zoom) { r.camera.zoom = Math.min(r.maxZoom || 5, Number(zoom)); r.camera.updateProjectionMatrix(); }
    if (shot) { r.centerOn((shot.x0 + shot.x1) / 2, (shot.z0 + shot.z1) / 2); return `shot ${shot.shooter?.classId}/${shot.shooter?.ageId}`; }
    const q = v.squads.find((s) => s.alive && s.onField && s.striking);
    if (q) { r.centerOn(q.x / 256, q.y / 256); return `fight ${q.classId}`; }
    return 'none';
  }, process.env.ZOOM || '');
  await page.waitForTimeout(2500);
  const fx = await page.evaluate(() => { const c = {}; window.__battleRenderer.fx.forEach((f) => { c[f.kind] = (c[f.kind] || 0) + 1; }); return c; });
  const file = `${outDir}/${prefix}-${t}s.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 85, timeout: 180000 });
  const mm = page.getByTestId('battle-minimap');
  if (await mm.count()) await mm.screenshot({ path: `${outDir}/${prefix}-${t}s-minimap.png`, timeout: 60000 });
  console.log(`${file} at=${at} fx=${JSON.stringify(fx)}`);
}
console.log(errors.length ? `errors:\n${errors.slice(0, 10).join('\n')}` : 'no page errors');
await browser.close();
