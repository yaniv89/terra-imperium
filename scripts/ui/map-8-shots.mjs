// scripts/ui/map-8-shots.mjs
// The campaign map on a phone and a desktop, as the AI playtester holds it (its own openGame, loadSlice
// and perform): a classical era save, then
//   start   the first view after the load
//   out     one pinch out (scale 0.5, playtest steps 10, 20, 24, 58), then a second
//   fling   a quick swipe: where the map is right after the finger lifts and 600 ms later
//   close   pinched in to the close view over the capital
//   fogfar  zoomed out over the player's land: what was seen against what never was
//   army    the army card after a tap on your army, then March and the target picked north
//   panel   a city sheet opened and closed: where the camera is
// at 844x390 and 1600x900, en and he, into plans/ui/map-8/<tag>-<scene>-<size>-<lang>.jpg, and prints
// the numbers (zoom, km across the screen, the pan carried after the finger lifts).
// Needs a dev server of this checkout (`npx vite --port 5197`).
//   node scripts/ui/map-8-shots.mjs [--url http://localhost:5197/terra-imperium/] [--tag after] [--only phone-en]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice, loadSlices, perform, SIZES } from '../ai/human-playtest.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const TAG = arg('--tag', 'after');
const ONLY = arg('--only', '');
const AGE = arg('--age', 'classical');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/map-8');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = loadSlices([AGE], () => {})[AGE];

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
for (const sizeId of ['phone', 'desktop']) {
  for (const lang of ['en', 'he']) {
    const id = `${sizeId}-${lang}`;
    if (ONLY && ONLY !== id) continue;
    const size = SIZES[sizeId];
    const g = await openGame(browser, { size, lang, url: URL_BASE });
    const { page } = g; g.mobile = size.mobile;
    await page.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
    await page.evaluate(() => { window.__E2E_MAP_TEST__ = true; });
    await loadSlice(g, save);
    for (let i = 0; i < 4; i++) { // quiet the cards the load opens
      const b = page.getByRole('button', { name: /^(Later|Continue|Close|אחר כך|המשך|סגירה|סגור)$/ });
      if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click');
      await wait(300);
    }
    const shot = (scene) => page.screenshot({ path: path.join(OUT, `${TAG}-${scene}-${id}.jpg`), type: 'jpeg', quality: 70 });
    const t = () => page.evaluate(() => window.__map2DTest?.transform() ?? null);
    const kmAcross = () => page.evaluate(() => {
      const m = window.__map2DTest; if (!m) return null;
      const a = m.project(30, 30); const b = m.project(30, 31); // one degree of longitude at 30N is 96 km
      return Math.round((innerWidth / Math.hypot(b.x - a.x, b.y - a.y)) * 96);
    });
    const W = size.width; const H = size.height; const cx = Math.round(W * 0.45); const cy = Math.round(H * 0.5);
    const log = (...a) => console.log(id, ...a);
    await wait(1500);
    log('start', JSON.stringify(await t()), 'km across', await kmAcross());
    await shot('start');
    await perform(g, { name: 'pinch', args: { x: cx, y: cy, scale: 0.5 } }); await wait(1200);
    log('out1', 'km across', await kmAcross());
    await shot('out1');
    await perform(g, { name: 'pinch', args: { x: cx, y: cy, scale: 0.5 } }); await wait(1200);
    log('out2', 'km across', await kmAcross());
    await shot('out2');
    // a quick swipe, 120 px in 5 moves of 16 ms, fired in the page: the sandbox's software GL takes over a
    // second a frame, so CDP touches arrive seconds apart; the swipe's clock is held at 16 ms a move
    const before = await t();
    await page.evaluate((touchy) => new Promise((done) => {
      const el = document.querySelector('canvas').parentElement;
      const real = performance.now.bind(performance); let fake = real(); performance.now = () => fake;
      const mk = (x) => (touchy ? new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 }) : null);
      const fire = (type, x, down) => (touchy
        ? el.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(x)] : [], changedTouches: [mk(x)], bubbles: true, cancelable: true }))
        : (type === 'touchend' ? window : el).dispatchEvent(new MouseEvent(type === 'touchstart' ? 'mousedown' : type === 'touchmove' ? 'mousemove' : 'mouseup', { clientX: x, clientY: 200, bubbles: true, view: window })));
      let k = 0; fire('touchstart', 380, true);
      const id = setInterval(() => {
        k += 1; fake += 16; fire('touchmove', 380 - 24 * k, true);
        if (k === 5) { clearInterval(id); fire('touchend', 260, false); performance.now = real; done(); }
      }, 16);
    }), !!size.mobile);
    await wait(3000); const after = await t();
    log('fling: finger moved 120 px; the map moved', Math.round(before.x - after.x), 'px in all');
    // close view over the capital
    await page.evaluate(async () => {
      const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
      const s = window.__game.state; const c = s.regions[s.nations[s.playerNationId].capitalRegionId];
      const T = getTiles(); window.__map2DTest.focus(...(({ lat, lon }) => [lat, lon])(T.latLonOf(c.tile)), 60);
    });
    await wait(2500);
    log('close', 'km across', await kmAcross());
    await shot('close');
    await perform(g, { name: 'pinch', args: { x: cx, y: cy, scale: 0.25 } }); await wait(800);
    await perform(g, { name: 'pinch', args: { x: cx, y: cy, scale: 0.25 } }); await wait(800);
    await perform(g, { name: 'pinch', args: { x: cx, y: cy, scale: 0.5 } }); await wait(1500);
    log('fogfar', 'km across', await kmAcross());
    await shot('fogfar');
    // your army: tap its banner, March, a target north
    const army = await page.evaluate(() => {
      const s = window.__game.state; const me = s.playerNationId;
      const u = Object.values(s.units).find((x) => x.ownerId === me && x.domain === 'land' && x.classId !== 'settler' && !x.explorer && x.tile != null);
      return u ? { id: u.id, tile: u.tile } : null;
    });
    if (army) {
      await page.evaluate(async (tile) => {
        const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
        const T = getTiles(); window.__map2DTest.focus(...(({ lat, lon }) => [lat, lon])(T.latLonOf(tile)), 14);
      }, army.tile);
      await wait(1500);
      const p = await page.evaluate(async (tile) => {
        const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
        const T = getTiles(); return window.__map2DTest.project(...(({ lat, lon }) => [lat, lon])(T.latLonOf(tile)));
      }, army.tile);
      log('army at', JSON.stringify(p), 'pick', JSON.stringify(await page.evaluate(([x, y]) => window.__map2DTest.pickAt(x, y), [p.x, p.y])));
      await perform(g, { name: 'tap', args: { x: Math.round(p.x), y: Math.round(p.y) } }); await wait(900);
      await shot('army');
      const march = page.getByRole('button', { name: /^(March|צעד)/ }).first();
      if (await march.isVisible().catch(() => false)) {
        await march.dispatchEvent('click'); await wait(900);
        await shot('march');
        // a hex of your own city's land beside the army (playtest run 40651416284 step 58: "already there")
        const own = await page.evaluate(async (tile) => {
          const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
          const T = getTiles(); const s = window.__game.state; const owner = s.world.tileOwner;
          const n = T.neighbors[tile].find((t) => T.land[t] && owner[t] && s.regions[owner[t]]?.owner === s.playerNationId);
          return n == null ? null : window.__map2DTest.project(...(({ lat, lon }) => [lat, lon])(T.latLonOf(n)));
        }, army.tile);
        if (own) {
          log('own hex pick in march', JSON.stringify(await page.evaluate(([x, y]) => window.__map2DTest.pickAt(x, y), [own.x, own.y])));
          await perform(g, { name: 'tap', args: { x: Math.round(own.x), y: Math.round(own.y) } }); await wait(900);
          log('march bar:', (await page.locator('[data-testid=march-bar]').textContent().catch(() => '')).slice(0, 120));
          await shot('march-own');
        }
        await perform(g, { name: 'tap', args: { x: Math.round(p.x + 30), y: Math.round(p.y - 90) } }); await wait(900);
        await shot('march-target');
        const cancel = page.locator('[data-testid=march-bar] button').last();
        if (await cancel.isVisible().catch(() => false)) await cancel.dispatchEvent('click');
        await wait(500);
      } else log('no March button');
      // a city sheet opened from the map and closed: the camera must stay where it was
      await page.keyboard.press('Escape'); await wait(500);
      const t0 = await t();
      const cityP = await page.evaluate(async () => {
        const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
        const s = window.__game.state; const c = s.regions[s.nations[s.playerNationId].capitalRegionId];
        return window.__map2DTest.project(...(({ lat, lon }) => [lat, lon])(getTiles().latLonOf(c.tile)));
      });
      await perform(g, { name: 'tap', args: { x: Math.round(cityP.x), y: Math.round(cityP.y) } }); await wait(1200);
      await shot('panel-open');
      await page.keyboard.press('Escape'); await wait(1200);
      const t1 = await t();
      log('panel: camera moved', Math.round(Math.hypot(t1.x - t0.x, t1.y - t0.y)), 'px; zoom', (t1.k / t0.k).toFixed(2));
      await shot('panel-closed');
    }
    await g.ctx.close();
    if (g.errors.length) log('page errors', g.errors.slice(0, 3));
  }
}
await browser.close();
