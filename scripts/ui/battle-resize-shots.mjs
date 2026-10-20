// scripts/ui/battle-resize-shots.mjs
// H-06 (audits/mobile-campaign-2026-10-20): resizing the pane during a battle dropped the
// battlefield's textures (trees grey-white, the keep black) and left the renderer wider than its
// window. This opens the battle sandbox, lets the battle's files go idle past the memory list's
// keep time (assetMemory.js, 15 s), then resizes (desktop to a phone-sized pane and back), changes
// the device pixel ratio, and drops idle model files as a map loading behind the battle would. After
// each step: a screenshot, the battle scene's textures that can no longer be drawn (closed bitmap:
// width 0), and the drawing buffer against the canvas's CSS size times the pixel ratio.
//   node scripts/ui/battle-resize-shots.mjs [--url http://localhost:5245/terra-imperium/?battleSandbox] [--tag before|after]
// Needs a running dev server. Shots go to audits/fix-h05/ (not committed).
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5245/terra-imperium/?battleSandbox');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/fix-h05'));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const check = (page) => page.evaluate(async () => {
  const r = window.__battleRenderer;
  const seen = new Set(); let drawn = 0; let broken = 0; const names = new Set();
  r.scene.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
      Object.values(mat || {}).forEach((tex) => {
        if (!tex?.isTexture || seen.has(tex) || tex.isRenderTargetTexture || tex.isDepthTexture) return;
        seen.add(tex); drawn += 1;
        const img = tex.image; const w = img?.width || img?.naturalWidth || img?.videoWidth || 0;
        if (!img || !w) { broken += 1; names.add(mat.name || mat.type); }
      });
    });
  });
  const c = r.renderer.domElement;
  const dpr = r.renderer.getPixelRatio();
  const { gltfMemory } = await import('/terra-imperium/src/battle/render/gltfUnitLoader.js');
  return {
    drawn, broken, brokenMaterials: [...names].slice(0, 8), memory: gltfMemory(),
    css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height], rendererDpr: dpr, windowDpr: window.devicePixelRatio,
    // the buffer is the canvas box at the screen's pixel ratio (the battle caps it at 2)
    sized: Math.abs(c.width - Math.round(c.clientWidth * Math.min(2, window.devicePixelRatio))) <= 1 && Math.abs(c.height - Math.round(c.clientHeight * Math.min(2, window.devicePixelRatio))) <= 1
  };
});

const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
const rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 1118, height: 646 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  let glWarnings = 0;
  page.on('console', (m) => { if (/GL_INVALID|texImage|TexStorage/i.test(m.text())) glWarnings += 1; else if (m.type() === 'error') console.log('console error', m.text().slice(0, 200)); });
  await page.goto(URL_BASE);
  await page.getByRole('button', { name: 'Fight' }).click();
  await page.getByTestId('battle-pause').waitFor({ timeout: 90000 });
  await wait(4000);
  const shot = async (step) => {
    await wait(2500);
    const file = path.join(OUT, `${TAG}-battle-${step}.png`);
    const measured = await check(page); // (before the screenshot: taking one resets an emulated pixel ratio)
    await page.screenshot({ path: file, timeout: 120000 });
    const row = { step, ...measured, glWarnings, file: path.relative(process.cwd(), file) };
    rows.push(row);
    console.log(JSON.stringify(row));
  };
  await shot('1-fresh');
  await wait(16000); // every file idle past the memory list's keep time
  await page.setViewportSize({ width: 800, height: 420 });
  await shot('2-resized-800x420');
  await page.setViewportSize({ width: 1118, height: 646 });
  await shot('3-back-1118x646');
  // a display or zoom change: the same CSS size, another pixel ratio
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1118, height: 646, deviceScaleFactor: 1.36, mobile: false });
  await shot('4-dpr-1.36');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1118, height: 646, deviceScaleFactor: 1, mobile: false });
  // the map behind the battle loading files past the budget: idle files are dropped
  await wait(16000);
  await page.evaluate(async () => { const m = await import('/terra-imperium/src/battle/render/gltfUnitLoader.js'); m.trimGltfCache(0); });
  await shot('5-files-trimmed');
  await context.close();
} finally {
  await browser.close();
}
const bad = rows.filter((r) => r.broken > 0 || !r.sized);
console.log(bad.length ? `BROKEN at ${bad.map((r) => `${r.step}${r.sized ? '' : ' (buffer size)'}`).join(', ')}` : 'textures and sizes ok');
