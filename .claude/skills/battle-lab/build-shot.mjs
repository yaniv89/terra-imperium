// .claude/skills/battle-lab/build-shot.mjs
// The worker build flow in a real browser (playtest audit CB15: U02, U05, U13, I173 to I187): the
// sandbox with the economy, you as the attacker; selects a laborer, shoots the worker actions (the
// round hammer, Stop working), opens the sheet, picks a barracks (the ghost, the green legal ground,
// the field edge), moves it with a tap, presses Build here (the sheet must come back once), then
// cancels a second placement (back to the sheet) and closes the sheet with its X (the laborer stays
// selected). Prints each state and console errors.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/build-shot.mjs <outDir> [--w 844 --h 390] [--browser <exe>]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&autostart&age=bronze`;
fs.mkdirSync(outDir, { recursive: true });
const tag = `${W}x${H}`;

const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.waitForTimeout(1500);
await page.getByTestId('battle-pause').click(); // Start: the sim runs (a site appears only then)
const shot = async (name) => { const f = path.join(outDir, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log(`shot ${f}`); };
const state = async (label) => {
  const s = await page.evaluate(() => ({
    context: document.querySelector('[data-testid="battle-context"]')?.dataset.context,
    sheet: !!document.querySelector('[data-testid="battle-build-menu"]'),
    hammer: !!document.querySelector('[data-testid="battle-worker-actions"] [data-testid="battle-build"]') || !!document.querySelector('[data-testid="battle-build"]'),
    place: document.querySelector('[data-testid="battle-place-reason"]')?.textContent || null,
    stock: window.__battleView?.()?.eco?.stock,
    sites: window.__battleView?.()?.eco?.buildings.filter((b) => b.side === 0 && !b.built).map((b) => b.type),
    overlay: window.__battleRenderer?.ecoLayer ? [window.__battleRenderer.ecoLayer.legalMesh.count, window.__battleRenderer.ecoLayer.blockedMesh.count] : null
  }));
  console.log(`${label}: ${JSON.stringify(s)}`);
  return s;
};
// Tap one of your laborers on the field.
const worker = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const q = v.squads.find((s) => s.side === 0 && s.classId === 'worker' && s.alive && s.onField);
  r.centerOn(q.x / 256, q.y / 256);
  return q.idx;
});
await page.waitForTimeout(400);
const wp = await page.evaluate((idx) => { const v = window.__battleView(); const q = v.squads[idx]; return window.__battleRenderer.worldToScreen(q.x / 256, q.y / 256, 0.4); }, worker);
await page.touchscreen.tap(wp.x, wp.y);
await page.waitForTimeout(500);
await state('laborer selected (no sheet by itself)');
await shot('1-worker-actions');
await page.getByTestId('battle-build').first().click();
await page.waitForTimeout(800);
await state('hammer pressed');
await shot('2-sheet');
await page.getByTestId('build-barracks').dispatchEvent('pointerdown', { pointerType: 'touch' });
await page.getByTestId('build-barracks').dispatchEvent('pointerup', { pointerType: 'touch' });
await page.waitForTimeout(1200);
await state('barracks in hand');
await shot('3-placing');
await page.evaluate(() => window.__battleRenderer.zoomBy(0.5, 422, 195));
await page.waitForTimeout(400);
await shot('3b-placing-wide');
if (process.env.DBG) console.log('DBG', JSON.stringify(await page.evaluate(() => { const L = window.__battleRenderer.ecoLayer; const a = L.legalMesh.instanceMatrix.array; const g = L.ghostMesh.instanceMatrix.array; return { legal0: [a[12], a[13], a[14]], count: L.legalMesh.count, ghost: [g[12], g[13], g[14]], order: [L.legalMesh.renderOrder, L.legalMesh.material.depthTest, L.legalMesh.material.opacity, L.legalMesh.visible, L.legalMesh.parent?.type] }; })));
await page.evaluate(() => window.__battleRenderer.zoomBy(2, 422, 195));
// Tap a green spot near the camp: the first legal centre the overlay knows of.
const spot = await page.evaluate(() => {
  const r = window.__battleRenderer; const o = r.ecoLayer.overlay; const w = r.setup.map.w;
  if (!o) return null;
  const cells = [...o.cells.keys()].filter((i) => o.cells[i]);
  const camp = window.__battleView().eco.buildings.find((b) => b.type === 'camp');
  cells.sort((a, b) => ((a % w) - camp.x / 256) ** 2 + (Math.floor(a / w) - camp.y / 256) ** 2 - (((b % w) - camp.x / 256) ** 2 + (Math.floor(b / w) - camp.y / 256) ** 2));
  const i = cells[Math.min(cells.length - 1, 40)];
  r.centerOn((i % w) + 0.5, Math.floor(i / w) + 0.5);
  return { x: (i % w) + 0.5, z: Math.floor(i / w) + 0.5, legal: cells.length };
});
console.log(`legal tiles for a barracks: ${spot?.legal}`);
await page.waitForTimeout(400);
if (spot) {
  const sp = await page.evaluate((s) => window.__battleRenderer.worldToScreen(s.x, s.z, 0), spot);
  await page.touchscreen.tap(sp.x, sp.y);
  await page.waitForTimeout(500);
}
await state('ghost moved by a tap (nothing built yet)');
await shot('4-ghost-moved');
await page.getByTestId('battle-place-confirm').click();
await page.waitForTimeout(1200);
await state('after Build here (the sheet is back once)');
await shot('5-placed-sheet-back');
await page.getByTestId('build-house').dispatchEvent('pointerdown', { pointerType: 'touch' });
await page.getByTestId('build-house').dispatchEvent('pointerup', { pointerType: 'touch' });
await page.waitForTimeout(600);
await page.getByTestId('battle-place-cancel').click();
await page.waitForTimeout(600);
await state('placement cancelled (back to the sheet, nothing spent)');
await page.getByTestId('battle-build-close').click();
await page.waitForTimeout(500);
await state('sheet closed with X (laborer still selected)');
await shot('6-closed');
console.log(`console errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log(`  ${e.slice(0, 300)}`));
await browser.close();
