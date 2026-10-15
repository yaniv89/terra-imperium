// .claude/skills/battle-lab/pause-orders-shot.mjs
// RTS-01 and RTS-03 in a real browser: the first-battle coach (touch words, Next, Skip), then orders
// given while paused (a move, a building, a laborer to train) shown at once, and gone into the
// battle after Resume. Shots and a line per state; the sandbox at one screen size, touch by default.
// Start the dev server first:  npx vite --port 5199 --strictPort --force &
//   node .claude/skills/battle-lab/pause-orders-shot.mjs <outDir> [--w 667 --h 375] [--browser <exe>]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 667)); const H = Number(opt('h', 375));
const touch = opt('touch', '1') === '1';
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.waitForTimeout(2000);
const tag = `${W}x${H}`;
const shot = async (name, note = '') => { const f = path.join(outDir, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log(`${name}${note ? `: ${note}` : ''}\n  ${f}`); };
const text = (id) => page.getByTestId(id).first().textContent().catch(() => null);
const tap = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
// a finger on a touch screen (a Playwright click is a mouse, and the words follow the pointer in use)
const press = async (id) => { const l = page.getByTestId(id).first(); if (touch) await l.tap(); else await l.click(); };

// RTS-01: the coach, on at deployment, the clock still paused for deployment only.
console.log('coach step 1:', await text('battle-coach-text'));
await shot('1-coach');
await press('battle-coach-next');
console.log('coach step 2:', await text('battle-coach-text'));
await press('battle-coach-next');
console.log('coach step 3:', await text('battle-coach-text'));
await shot('2-coach-3');
await press('battle-coach-next');
console.log('coach gone:', !(await page.getByTestId('battle-coach').count()), 'stored:', await page.evaluate(() => localStorage.getItem('ti.coach.firstBattle')));

// Start, then pause and give orders.
await press('battle-pause');
await page.waitForTimeout(2000);
await press('battle-pause');
await page.waitForTimeout(400);
await press('battle-pause-orders');
await press('battle-select-all');
const tick0 = await page.evaluate(() => window.__battleView().tick);
// a spot of open ground ahead of the army
const spot = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const own = v.squads.filter((q) => q.side === 0 && q.alive && q.onField && q.classId !== 'worker');
  const cx = own.reduce((s, q) => s + q.x, 0) / own.length / 256; const cz = own.reduce((s, q) => s + q.y, 0) / own.length / 256;
  r.centerOn(cx + 6, cz); r.updateCamera();
  return r.worldToScreen(cx + 10, cz, 0);
});
await tap(spot.x, spot.y);
await page.waitForTimeout(1800); // the old flash would be gone by now
const marks = await page.evaluate(() => window.__battleRenderer.pendingMarks.map((m) => `${m.kind}@${m.x.toFixed(1)},${m.z.toFixed(1)}`));
console.log('paused move: tick', tick0, '->', await page.evaluate(() => window.__battleView().tick), '| pending marks', marks.join(' '), '| pins', await page.evaluate(() => [...document.querySelectorAll('[data-testid="battle-pending-pin"]')].filter((e) => e.style.display !== 'none').length), '| note:', await text('battle-order-note'));
await shot('3-paused-move');
{ const cx = Math.max(0, Math.min(W - 220, spot.x - 110)); const cy = Math.max(0, Math.min(H - 160, spot.y - 80));
  const f = path.join(outDir, `${tag}-3b-paused-move-close.png`); await page.screenshot({ path: f, clip: { x: cx, y: cy, width: 220, height: 160 } }); console.log(`  the spot ${Math.round(spot.x)},${Math.round(spot.y)}: ${f}`); }

// A laborer to train at the camp, while paused.
if (await page.getByTestId('battle-view-more').count()) await press('battle-view-more');
await press('battle-hq');
await page.waitForTimeout(400);
if (await page.getByTestId('train-worker').count()) {
  await press('train-worker');
  await page.waitForTimeout(1600); // past the old 1.2 s "not queued" verdict
  console.log('paused training: waiting cards', await page.getByTestId('battle-train-waiting').count(), '| note:', await text('battle-train-waiting-note'), '| refusal:', await text('battle-train-note'));
  await shot('4-paused-train');
}

// A building while paused: a laborer (tapped on the field), the build sheet, the first tile where
// the ghost first stands.
const wp = await page.evaluate(() => {
  const v = window.__battleView(); const r = window.__battleRenderer;
  const q = v.squads.find((s) => s.side === 0 && s.classId === 'worker' && s.alive && s.onField);
  if (!q) return null;
  r.centerOn(q.x / 256, q.y / 256); r.updateCamera();
  return r.worldToScreen(q.x / 256, q.y / 256, 0.4);
});
if (wp) {
  await tap(wp.x, wp.y);
  await page.waitForTimeout(400);
  if (await page.getByTestId('battle-build').count()) {
    await press('battle-build');
    await page.waitForTimeout(500);
    const tile = page.locator('[data-testid^="build-"]:not([aria-disabled="true"])').first();
    if (await tile.count()) {
      if (touch) await tile.tap(); else await tile.click();
      await page.waitForTimeout(500);
      // move the ghost round the camp until the spot is good (a tap off the ghost moves it there)
      let ok = await page.getByTestId('battle-place-confirm').isEnabled().catch(() => false);
      for (const [fx, fy] of [[0.3, 0.45], [0.4, 0.6], [0.25, 0.65], [0.5, 0.4], [0.35, 0.3], [0.2, 0.5]]) {
        if (ok) break;
        await tap(Math.round(W * fx), Math.round(H * fy));
        await page.waitForTimeout(250);
        ok = await page.getByTestId('battle-place-confirm').isEnabled().catch(() => false);
      }
      if (ok) {
        await press('battle-place-confirm');
        await page.waitForTimeout(1500);
        console.log('paused build: pending ghosts', await page.evaluate(() => window.__battleRenderer.ecoLayer.pendingMesh?.count ?? -1));
        if (await page.getByTestId('battle-build-close').count()) await press('battle-build-close'); // the sheet comes back after a placement (U13)
        await page.waitForTimeout(300);
        await shot('5-paused-build');
      } else console.log('paused build: the first spot was not good, skipped');
    }
  }
}

// Resume: the battle takes the orders and the marks go.
await page.getByTestId('battle-paused-pill').click().catch(() => {});
await page.getByTestId('battle-resume').click().catch(async () => { await page.getByTestId('battle-pause').click(); });
await page.waitForTimeout(1500);
console.log('after Resume: pending marks', await page.evaluate(() => window.__battleRenderer.pendingMarks.length), '| queue cards', await page.locator('[data-testid="battle-train-queue"] button').count());
await shot('6-resumed');
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
