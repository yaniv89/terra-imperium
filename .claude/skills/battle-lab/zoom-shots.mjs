// .claude/skills/battle-lab/zoom-shots.mjs
// The soldiers at several camera zooms and screen sizes (the "units look awful when zoomed out"
// check): opens the battle sandbox (default: kingdoms, mixed terrain), starts the battle, pauses,
// centres on the player's army and saves one jpg per (size, zoom) with the soldier detail level
// the renderer picked. Dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/zoom-shots.mjs <outDir> [prefix]
// SIZES="phone:874x402@3,ipad:1180x820@2,desktop:1600x900@1"  ZOOMS="near:2,far:1,farther:0.6"
// TIER=0|1|2 forces a detail level (otherwise the renderer picks by size on screen and budget).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'shot';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox';
const sizes = (process.env.SIZES || 'phone:874x402@3,ipad:1180x820@2,desktop:1600x900@1').split(',').map((s) => {
  const [name, rest] = s.split(':'); const [wh, dpr] = rest.split('@'); const [w, h] = wh.split('x').map(Number);
  return { name, w, h, dpr: Number(dpr || 1) };
});
const zooms = (process.env.ZOOMS || 'near:2,far:1,farther:0.6').split(',').map((s) => { const [name, z] = s.split(':'); return { name, z: Number(z) }; });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr, hasTouch: size.name !== 'desktop' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
  await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  // Start the fight, let the armies close at 3x, then pause (the user's report: paused at 28:24).
  const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id); // big canvases on SwiftShader stall Playwright's own click
  await tap('battle-pause');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
  await page.waitForTimeout(Number(process.env.WAIT || 12000));
  await tap('battle-pause');
  await page.waitForTimeout(800);
  await tap('battle-pause-orders');
  for (const zm of zooms) {
    const info = await page.evaluate(({ z, tier }) => {
      const r = window.__battleRenderer;
      r.camera.zoom = Math.min(r.maxZoom || 3, z); r.camera.updateProjectionMatrix();
      if (tier !== '') { r.detail.bias = 0; r.detail.ceiling = 0; r.forceTier = Number(tier); }
      const own = (window.__battleView?.()?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField);
      if (own.length) r.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / 256, own.reduce((a, q) => a + q.y, 0) / own.length / 256);
      r.updateCamera();
      return { zoom: r.camera.zoom, px: r.soldierPx() };
    }, { z: zm.z, tier: process.env.TIER ?? '' });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { const r = window.__battleRenderer; return { tier: r.soldierTier, bias: r.detail.bias, figures: [...r.soldierLayers.values()].reduce((s, l) => s + l.count, 0) }; });
    const file = `${outDir}/${prefix}-${size.name}-${zm.name}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 80, timeout: 180000 });
    console.log(`${file} zoom=${info.zoom.toFixed(2)} soldierPx=${info.px.toFixed(1)} tier=${st.tier} bias=${st.bias} figures=${st.figures}`);
  }
  if (errors.length) console.log(`errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}
await browser.close();
