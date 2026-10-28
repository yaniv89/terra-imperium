// .claude/skills/battle-lab/transition-shot.mjs
// The way into and out of a battle frame by frame (art-2 lane): after Fight, shoots every ~0.4 s
// while the loading screen gives way to the field (the canvas fading in, the camera settling), then
// calls the renderer's outro (as the screen does when the battle ends) and shoots the pull-back.
// Dev server first (npx vite --port 5199 --strictPort), then:
//   node .claude/skills/battle-lab/transition-shot.mjs <outDir> [prefix]
// URL (default the Bronze sandbox), W, H (844 x 390), DPR (2), N (shots each way, 5).
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'trans';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox&age=bronze';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390); const N = Number(process.env.N || 5);
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR || 2), hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('ti.hint.battleControls', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
await page.goto(url, { timeout: 240000 });
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer?.lastView, null, { timeout: 120000, polling: 50 });
const state = () => page.evaluate(() => { const r = window.__battleRenderer; return { zoom: +r.camera.zoom.toFixed(3), opacity: getComputedStyle(r.renderer.domElement).opacity, move: !!r.camMove }; });
for (let i = 0; i < N; i++) {
  const s = await state();
  await page.screenshot({ path: `${outDir}/${prefix}-in-${i}.jpg`, type: 'jpeg', quality: 80, timeout: 180000 });
  console.log(`in ${i} ${JSON.stringify(s)}`);
}
await page.waitForTimeout(4000);
await page.evaluate(() => window.__battleRenderer.startOutro());
for (let i = 0; i < N; i++) {
  const s = await state();
  await page.screenshot({ path: `${outDir}/${prefix}-out-${i}.jpg`, type: 'jpeg', quality: 80, timeout: 180000 });
  console.log(`out ${i} ${JSON.stringify(s)}`);
}
await browser.close();
