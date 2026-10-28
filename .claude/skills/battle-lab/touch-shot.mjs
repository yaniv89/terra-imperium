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
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: exe, headless: true });
const visible = (page, id) => page.getByTestId(id).isVisible().catch(() => false);
const text = (page, id) => page.getByTestId(id).textContent().catch(() => null);

for (const age of ages) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${age}-${name}.png`) });
  await page.goto(`${base}?battleSandbox&autostart&age=${age}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByTestId('battle-pause').tap(); // Start
  if (await page.getByTestId('battle-speed-3').count()) await page.getByTestId('battle-speed-3').tap();
  await page.waitForTimeout(1500);
  // 1. Enemy: Attack it must wait for the player (it used to go in 7 s)
  if (await page.getByTestId('battle-objective').count()) {
    await page.getByTestId('battle-objective').tap();
    await page.waitForTimeout(10000);
    const still = await visible(page, 'battle-objective-attack');
    console.log(`${age} objective: Attack it after 10 s: ${still ? 'shown' : 'GONE'} | "${await text(page, 'battle-objective-note')}"`);
    await shot('1-objective');
    if (still) { await page.getByTestId('battle-objective-attack').tap(); await page.waitForTimeout(300); console.log(`${age} objective: after Attack it: "${await text(page, 'battle-order-note')}"`); }
  }
  // 2. Attack armed, then a tap on the ground
  await page.getByTestId('battle-select-all').tap();
  await page.waitForTimeout(300);
  if (await page.getByTestId('battle-attack-move').count()) {
    await page.getByTestId('battle-attack-move').tap();
    await page.waitForTimeout(300);
    console.log(`${age} attack armed chip: ${await visible(page, 'battle-attack-armed')}`);
    await shot('2-armed');
    await page.touchscreen.tap(W * 0.55, H * 0.5);
    await page.waitForTimeout(250);
    console.log(`${age} after ground tap: chip ${await visible(page, 'battle-attack-armed') ? 'STILL ARMED' : 'gone (order given)'}`);
    await shot('3-order');
  }
  // 3. Powers: each one as soon as it can be paid for
  const powers = await page.evaluate(() => (window.__battleView?.()?.powers || []).map((p) => ({ id: p.id, cost: p.cost, targeted: p.targeted })));
  for (const pw of powers) {
    await page.waitForFunction((id) => { const p = window.__battleView?.()?.powers?.find((x) => x.id === id); const v = window.__battleView?.(); return p && p.readyIn <= 0 && v.supply[0] >= p.cost; }, pw.id, { timeout: 60000 }).catch(() => null);
    if (!(await page.getByTestId('battle-wand').count())) { await page.getByTestId('battle-select-all').tap(); await page.waitForTimeout(200); }
    if (!(await page.getByTestId('battle-wand').count())) break;
    await page.getByTestId('battle-wand').tap();
    await page.waitForTimeout(250);
    const btn = page.getByTestId(`battle-power-${pw.id}`);
    if (!(await btn.count()) || await btn.isDisabled()) { console.log(`${age} power ${pw.id}: not ready`); await page.keyboard.press('Escape'); continue; }
    await btn.tap();
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
    await page.waitForTimeout(pw.targeted ? 400 : 250);
    console.log(`${age} power ${pw.id}: note "${await text(page, 'battle-order-note')}"`);
    await shot(`4-power-${pw.id}`);
  }
  // 4. Flags zoomed out over the army
  await page.evaluate(() => { const v = window.__battleView(); const r = window.__battleRenderer; const own = v.squads.filter((q) => q.side === 0 && q.alive && q.onField); r.centerOn(own.reduce((s, q) => s + q.x, 0) / own.length / 256, own.reduce((s, q) => s + q.y, 0) / own.length / 256); r.zoomBy(0.6, innerWidth / 2, innerHeight / 2); r.updateCamera(); });
  await page.waitForTimeout(500);
  await shot('5-flags');
  console.log(`${age}: ${errors.length ? `errors: ${errors.slice(0, 5).join(' | ')}` : 'no console errors'}`);
  await ctx.close();
}
await browser.close();
