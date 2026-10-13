// .claude/skills/battle-lab/unit-closeup.mjs
// One unit class up close and at every zoom, cropped round the squad (HUD hidden), for judging a
// unit model: node unit-closeup.mjs <base url> <outDir> <prefix>
//   CLASS=infantry (ECO=1 CLASS=worker for the labourer: the battle economy on) AGE=bronze ZOOMS=z6:6,z3:3,z2:2,z1:1,z06:0.6 TIER=0|1|2 (force a detail level)
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
await page.goto(`${base}?battleSandbox&age=${process.env.AGE || 'bronze'}&terrain=plains&attacker=small&defender=small${process.env.ECO ? '' : '&noeco'}`);
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
await page.waitForTimeout(2500);
await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)) { visibility: hidden !important; }' });
for (const [name, z] of zooms) {
  const at = async () => page.evaluate(([zz, tier, c]) => {
    const r = window.__battleRenderer;
    r.maxZoom = Math.max(r.maxZoom || 3, zz);
    r.camera.zoom = zz; r.camera.updateProjectionMatrix();
    if (tier !== '') { r.detail.bias = 0; r.detail.ceiling = 0; r.forceTier = Number(tier); }
    const q = (window.__battleView?.()?.squads || []).filter((s) => s.side === 0 && s.alive && s.classId === c).sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
    if (!q) return null;
    r.centerOn(q.x / 256, q.y / 256); r.updateCamera(); r.camera.updateMatrixWorld();
    const v = r.camera.position.clone().set(q.x / 256, 0.5, q.y / 256).project(r.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, px: r.soldierPx(), tier: r.soldierTier };
  }, [z, process.env.TIER ?? '', cls]);
  await at();
  await page.waitForTimeout(1200);
  const info = await at();
  await page.waitForTimeout(300);
  const w = Math.min(844, Math.max(150, info.px * 7)); const h = Math.min(390, w * 0.8);
  const clip = { x: Math.max(0, Math.min(844 - w, info.x * 844 - w / 2)), y: Math.max(0, Math.min(390 - h, info.y * 390 - h / 2)), width: w, height: h };
  await page.screenshot({ path: `${outDir}/${prefix}-${name}.jpg`, type: 'jpeg', quality: 90, clip });
  console.log(name, 'soldierPx', info.px.toFixed(1), 'tier', info.tier);
}
if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | '));
await browser.close();
