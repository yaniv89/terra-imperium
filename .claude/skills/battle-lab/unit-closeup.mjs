// .claude/skills/battle-lab/unit-closeup.mjs
// One unit class up close and at every zoom, cropped round the squad (HUD hidden), for judging a
// unit model: node unit-closeup.mjs <base url> <outDir> <prefix>
//   CLASS=infantry (ECO=1 CLASS=worker for the labourer: the battle economy on) AGE=bronze ZOOMS=z6:6,z3:3,z2:2,z1:1,z06:0.6 TIER=0|1|2 (force a detail level)
//   PARAMS='attacker=cavalry' (sandbox URL parameters, over the defaults; BattleSandbox.jsx: attacker=cavalry|siege|support,
//     raid=raid for the raiders, merc for the hired band) SIDE=0|1 (whose squad; the raiders are side 0)
//   LAYER=general (centre on the first figure of that model layer, e.g. the general beside his standard)
//   ARMY=engineers (your side's sandbox preset, small by default; engineers brings the support class)
//   EXTRA=merc (more sandbox URL parameters, joined with &: merc draws your infantry as the hired band)
//   (PARAMS and EXTRA both add sandbox parameters; PARAMS wins where they name the same one)
// Writes <prefix>-<zoom>.jpg (the squad centred, the crop scaled to the zoom) for a 844x390 phone at DPR 3.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [base, outDir, prefix] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const cls = process.env.CLASS || 'infantry';
const zooms = (process.env.ZOOMS || 'z6:6,z3:3,z2:2,z1:1,z06:0.6').split(',').map((s) => { const [n, z] = s.split(':'); return [n, Number(z)]; });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11'] });
const DPR = 3;
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: DPR, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const query = new URLSearchParams({ age: process.env.AGE || 'bronze', terrain: 'plains', attacker: process.env.ARMY || 'small', defender: 'small' });
if (!process.env.ECO) query.set('noeco', '');
new URLSearchParams((process.env.EXTRA || '').replace(/^&/, '')).forEach((v, k) => query.set(k, v));
new URLSearchParams(process.env.PARAMS || '').forEach((v, k) => query.set(k, v));
const side = Number(process.env.SIDE || 0);
const layerKey = process.env.LAYER ? `${query.get('age')}:${process.env.LAYER}` : '';
await page.goto(`${base}?battleSandbox&${query.toString().replace(/=(&|$)/g, '$1')}`, { timeout: 180000 });
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
await page.waitForTimeout(2500);
await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)) { visibility: hidden !important; }' });
for (const [name, z] of zooms) {
  const at = async () => page.evaluate(([zz, tier, c, sd, lk]) => {
    const r = window.__battleRenderer;
    r.maxZoom = Math.max(r.maxZoom || 3, zz);
    r.camera.zoom = zz; r.camera.updateProjectionMatrix();
    if (tier !== '') { r.detail.bias = 0; r.detail.ceiling = 0; r.forceTier = Number(tier); }
    const q = (window.__battleView?.()?.squads || []).filter((s) => s.side === sd && s.alive && s.classId === c).sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
    const layer = lk ? r.soldierLayers.get(lk) : null;
    if (lk ? !(layer && layer.count) : !q) return null;
    const px = layer ? layer.matrix.array[12] : q.x / 256; const pz = layer ? layer.matrix.array[14] : q.y / 256;
    r.centerOn(px, pz); r.updateCamera(); r.camera.updateMatrixWorld();
    const v = r.camera.position.clone().set(px, 0.5, pz).project(r.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, px: r.soldierPx(), tier: r.soldierTier };
  }, [z, process.env.TIER ?? '', cls, side, layerKey]);
  await at();
  await page.waitForTimeout(1200);
  const info = await at();
  if (!info) { console.log(name, 'nothing to centre on: class', cls, 'side', side, layerKey); continue; }
  await page.waitForTimeout(300);
  const w = Math.min(844, Math.max(150, info.px * 7)); const h = Math.min(390, w * 0.8);
  const clip = { x: Math.max(0, Math.min(844 - w, info.x * 844 - w / 2)), y: Math.max(0, Math.min(390 - h, info.y * 390 - h / 2)), width: w, height: h };
  await page.screenshot({ path: `${outDir}/${prefix}-${name}.jpg`, type: 'jpeg', quality: 90, clip });
  console.log(name, 'soldierPx', info.px.toFixed(1), 'tier', info.tier);
}
if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | '));
await browser.close();
