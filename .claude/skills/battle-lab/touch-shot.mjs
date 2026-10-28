// .claude/skills/battle-lab/touch-shot.mjs
// Touch orders, powers and flags on a phone (battle-touch lane, playtest 40650979770). Per age: the
// sandbox at 3x on a touch screen; Enemy, then 10 real seconds (Attack it must still be there);
// Attack armed (its chip), a tap on the ground (the order lands, the chip goes); every power the
// side has, fired as soon as supply allows (ring, bursts, label); the army zoomed out (flags).
// Dev server first:  npx vite --port 5199 --strictPort &
//   AGES=stone,bronze,gunpowder,modern,future node .claude/skills/battle-lab/touch-shot.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const ages = (process.env.AGES || 'stone,bronze,kingdoms,gunpowder,modern,information,future').split(',');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
// PART=powers: only the powers, at 1x from the start (at 3x the army can be gone before supply allows)
const part = process.env.PART || 'all';
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: exe, headless: true });
const visible = (page, id) => page.getByTestId(id).isVisible().catch(() => false);
// a raw tap at the element's centre: the HUD re-renders every frame, which stalls locator.tap's stability wait
const tap = async (page, id) => { const el = await page.$(`[data-testid="${id}"]`); const bb = el && await el.boundingBox(); if (bb) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return !!bb; };
// a touch held `ms` (CDP touch events: Playwright's tap is instant)
const hold = async (page, x, y, ms) => {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
};
const text = (page, id) => page.getByTestId(id).textContent().catch(() => null);

for (const age of ages) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${age}-${name}.png`) });
  try {
  await page.goto(`${base}?battleSandbox&autostart&age=${age}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await tap(page, 'battle-pause'); // Start
  await page.waitForTimeout(1500);
  // 1. At 1x: Attack armed, then a tap on the ground, a slow tap, the minimap, the radial
  await tap(page, 'battle-select-all');
  await page.waitForTimeout(300);
  if (part !== 'powers' && await page.getByTestId('battle-attack-move').count()) {
    await tap(page, 'battle-attack-move');
    await page.waitForTimeout(300);
    console.log(`${age} attack armed chip: ${await visible(page, 'battle-attack-armed')}`);
    await shot('2-armed');
    await page.touchscreen.tap(W * 0.55, H * 0.5);
    await page.waitForTimeout(250);
    console.log(`${age} after ground tap: chip ${await visible(page, 'battle-attack-armed') ? 'STILL ARMED' : 'gone (order given)'} | "${await text(page, 'battle-order-note')}"`);
    await shot('3-order');
    // a slow tap (320 ms, between a quick tap and a long press) must land too
    await tap(page, 'battle-attack-move'); await page.waitForTimeout(200);
    await hold(page, W * 0.5, H * 0.45, 320);
    await page.waitForTimeout(250);
    console.log(`${age} slow tap (320 ms): chip ${await visible(page, 'battle-attack-armed') ? 'STILL ARMED' : 'gone (order given)'}`);
    // the minimap with Attack armed: the order lands there
    if (await page.getByTestId('battle-view-more').count()) { await tap(page, 'battle-view-more'); await page.waitForTimeout(200); }
    if (await page.getByTestId('battle-minimap-toggle').count()) {
      await tap(page, 'battle-minimap-toggle'); await page.waitForTimeout(400);
      await tap(page, 'battle-attack-move'); await page.waitForTimeout(200);
      const mm = await page.getByTestId('battle-minimap').boundingBox();
      if (mm) await page.touchscreen.tap(mm.x + mm.width * 0.7, mm.y + mm.height * 0.5);
      await page.waitForTimeout(250);
      console.log(`${age} minimap tap with Attack armed: chip ${await visible(page, 'battle-attack-armed') ? 'STILL ARMED' : 'gone (order given)'} | "${await text(page, 'battle-order-note')}"`);
      await shot('3b-minimap-order');
      if (await page.getByTestId('battle-view-more').count()) { await tap(page, 'battle-view-more'); await page.waitForTimeout(200); }
      await tap(page, 'battle-minimap-toggle');
    }
    // the radial's Attack (a long press on a selected squad), then a tap on the ground
    const sq = await page.evaluate(() => { const v = window.__battleView(); const r = window.__battleRenderer; const q = v.squads.find((s) => s.side === 0 && s.alive && s.onField && s.classId !== 'worker'); r.centerOn(q.x / 256, q.y / 256); r.updateCamera(); return r.worldToScreen(q.x / 256, q.y / 256, 0.4); });
    await page.waitForTimeout(150);
    await hold(page, sq.x, sq.y, 600);
    await page.waitForTimeout(500);
    if (await page.getByTestId('battle-radial-attackMove').count()) {
      await tap(page, 'battle-radial-attackMove'); await page.waitForTimeout(250);
      const armedNow = await visible(page, 'battle-attack-armed');
      await page.touchscreen.tap(W * 0.7, H * 0.4); await page.waitForTimeout(250);
      console.log(`${age} radial Attack: armed ${armedNow}, after ground tap ${await visible(page, 'battle-attack-armed') ? 'STILL ARMED' : 'gone (order given)'}`);
    } else console.log(`${age} radial: did not open`);
  }
  // 2. Enemy at 3x with nothing selected: Attack it must wait for the player (it used to go in 7 s) and send the army
  if (part !== 'powers' && await page.getByTestId('battle-objective').count()) {
    await tap(page, 'battle-speed-3');
    if (await page.getByTestId('battle-clear-selection').count()) await tap(page, 'battle-clear-selection');
    await tap(page, 'battle-objective');
    await page.waitForTimeout(10000);
    const still = await visible(page, 'battle-objective-attack');
    console.log(`${age} objective: Attack it after 10 s: ${still ? 'shown' : 'GONE'} | "${await text(page, 'battle-objective-note')}"`);
    await shot('1-objective');
    if (still) { await tap(page, 'battle-objective-attack'); await page.waitForTimeout(300); console.log(`${age} objective: after Attack it: "${await text(page, 'battle-order-note')}"`); await page.waitForTimeout(1000); console.log(`${age} objective: squads with an attack order: ${await page.evaluate(() => window.__battleView().squads.filter((q) => q.side === 0 && q.alive && q.onField && q.order === 'attack').length)} of ${await page.evaluate(() => window.__battleView().squads.filter((q) => q.side === 0 && q.alive && q.onField && q.classId !== 'worker').length)}`); }
  }
  // 3. Powers: each one as soon as it can be paid for (PART=orders skips them)
  if (part !== 'orders') {
  const powers = await page.evaluate(() => (window.__battleView?.()?.powers || []).map((p) => ({ id: p.id, cost: p.cost, targeted: p.targeted })));
  for (const pw of powers) {
    await page.waitForFunction((id) => { const p = window.__battleView?.()?.powers?.find((x) => x.id === id); const v = window.__battleView?.(); return p && p.readyIn <= 0 && v.supply[0] >= p.cost; }, pw.id, { timeout: 60000 }).catch(() => null);
    if (!(await page.getByTestId('battle-wand').count())) { await tap(page, 'battle-select-all'); await page.waitForTimeout(200); }
    if (!(await page.getByTestId('battle-wand').count())) break;
    await tap(page, 'battle-wand');
    await page.waitForTimeout(250);
    const off = await page.evaluate((id) => { const b = document.querySelector(`[data-testid="battle-power-${id}"]`); return !b || b.disabled; }, pw.id);
    if (off) { console.log(`${age} power ${pw.id}: not ready`); await page.keyboard.press('Escape'); continue; }
    await tap(page, `battle-power-${pw.id}`);
    if (pw.targeted) {
      await page.waitForTimeout(200);
      const at = await page.evaluate(({ id }) => {
        const v = window.__battleView(); const r = window.__battleRenderer;
        const foe = v.squads.filter((q) => q.side === 1 && q.alive && q.onField && q.visible !== false);
        const own = v.squads.filter((q) => q.side === 0 && q.alive && q.onField && q.classId !== 'worker');
        const list = id === 'ambush' || !foe.length ? own : foe;
        const x = list.reduce((s, q) => s + q.x, 0) / list.length / 256; const z = list.reduce((s, q) => s + q.y, 0) / list.length / 256;
        r.centerOn(x, z); r.updateCamera();
        return r.worldToScreen(x, z, 0);
      }, { id: pw.id });
      await page.touchscreen.tap(at.x, at.y);
    }
    await page.waitForTimeout(300);
    console.log(`${age} power ${pw.id}: note "${await text(page, 'battle-order-note')}"`);
    await shot(`4-power-${pw.id}`);
    if (pw.targeted) { await page.waitForTimeout(1500); await shot(`4-power-${pw.id}-landed`); } // a strike lands after its delay
  }
  }
  // 4. Flags zoomed out over the army
  await page.evaluate(() => { const v = window.__battleView(); const r = window.__battleRenderer; const own = v.squads.filter((q) => q.side === 0 && q.alive && q.onField); r.centerOn(own.reduce((s, q) => s + q.x, 0) / own.length / 256, own.reduce((s, q) => s + q.y, 0) / own.length / 256); r.zoomBy(0.6, innerWidth / 2, innerHeight / 2); r.updateCamera(); });
  await page.waitForTimeout(500);
  await shot('5-flags');
  } catch (err) { console.log(`${age}: SCRIPT STOPPED: ${err.message.split('\n')[0]}`); }
  console.log(`${age}: ${errors.length ? `errors: ${errors.slice(0, 5).join(' | ')}` : 'no console errors'}`);
  await ctx.close();
}
await browser.close();
