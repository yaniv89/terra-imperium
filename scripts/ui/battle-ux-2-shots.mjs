// scripts/ui/battle-ux-2-shots.mjs
// Screenshots for the battle UX pass 2 (plans/UI-DESIGN.md section 10: the context panel, the site's
// build bar, the placement ghost) in a real browser, against a running dev server
// (npx vite --port 5199 --strictPort):
//   node scripts/ui/battle-ux-2-shots.mjs <outDir> [--w 844 --h 390]
//   idle        nothing selected
//   site        a barracks going up, nothing selected (its bar on the field), then selected
//   barracks    the finished barracks selected (its actions)
//   inspect-tower a town tower tapped (its bar on the field)
//   army        an infantry squad selected
//   worker      a laborer selected (the build menu lives here)
//   place-ok / place-bad   the placement ghost on good ground and on blocked ground, with the reason
// Uses the DEV-only hooks window.__battleRenderer, __battleView and __battleOrders (TacticalBattleScreen.jsx).
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'plans/ui/battle-ux-2/after';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const touch = W < 900;
const tag = `${W}x${H}`;
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { try { localStorage.setItem('ti.hint.battleControls', '1'); } catch { /* blocked */ } });
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
await page.waitForTimeout(1500);

const shot = async (name) => { const file = path.join(outDir, `${name}-${tag}.png`); await page.screenshot({ path: file }); console.log('saved', file); };
const view = (fn, arg) => page.evaluate(fn, arg);
const screenOf = (x, y) => view(([sx, sy]) => window.__battleRenderer.worldToScreen(sx / 256, sy / 256), [x, y]);
const tapWorld = async (x, y) => {
  const p = await screenOf(x, y);
  if (touch) await page.touchscreen.tap(Math.round(p.x), Math.round(p.y)); else await page.mouse.click(Math.round(p.x), Math.round(p.y));
  await page.waitForTimeout(450);
};
const centre = (x, y, zoom = 0) => view(([cx, cy, z]) => { if (z) window.__battleRenderer.zoomBy(z); window.__battleRenderer.centerOn(cx / 256, cy / 256); }, [x, y, zoom]);
const clear = async () => { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
const setPaused = async (on) => {
  const label = await page.getByTestId('battle-pause').getAttribute('aria-label');
  if (on && label === 'Pause') { await page.getByTestId('battle-pause').click(); await page.getByTestId('battle-pause-orders').click({ timeout: 3000 }).catch(() => {}); }
  if (!on && label === 'Resume') { await page.getByTestId('battle-paused-pill').click({ timeout: 2000 }).catch(() => {}); await page.getByTestId('battle-resume').click({ timeout: 2000 }).catch(() => {}); }
  await page.waitForTimeout(300);
};

// Start at 3x.
await page.getByTestId('battle-pause').click();
await view(() => { const b = [...document.querySelectorAll('button')].find((x) => /^1×$/.test(x.textContent.trim())); b?.click(); b?.click(); });
await page.waitForTimeout(800);
const camp = await view(() => { const c = window.__battleView().eco.buildings.find((b) => b.side === 0 && b.type === 'camp'); return { x: c.x, y: c.y }; });

await setPaused(true);
await centre(camp.x + 3 * 256, camp.y, 1.4);
await page.waitForTimeout(500);
await shot('idle');
await setPaused(false);

// A barracks by the camp, raised by every laborer.
const spots = [];
for (const r of [6, 9, 12]) for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) spots.push([dx * r, dy * r]);
for (const [dx, dy] of spots) {
  const placed = await view(([ox, oy]) => {
    const v = window.__battleView(); const c = v.eco.buildings.find((b) => b.side === 0 && b.type === 'camp');
    if (v.eco.buildings.some((b) => b.side === 0 && b.type === 'barracks')) return true;
    const workers = v.squads.filter((q) => q.side === 0 && q.classId === 'worker').map((q) => q.idx);
    window.__battleOrders([{ side: 0, type: 'build', squads: workers, building: 'barracks', tx: Math.floor(c.x / 256) + ox - 1, ty: Math.floor(c.y / 256) + oy - 1 }]);
    return false;
  }, [dx, dy]);
  if (placed) break;
  await page.waitForTimeout(250);
}
let site = null;
for (let t = 0; t < 80 && !site; t++) {
  await page.waitForTimeout(400);
  site = await view(() => { const b = window.__battleView().eco.buildings.find((x) => x.side === 0 && x.type === 'barracks' && !x.built && x.alive && x.progress >= 35); return b ? { idx: b.idx, x: b.x, y: b.y, progress: b.progress, hp: b.hp, maxHp: b.maxHp } : null; });
}
console.log('site', JSON.stringify(site));
if (site) {
  await setPaused(true);
  await centre(site.x, site.y);
  await page.waitForTimeout(500);
  await shot('site');
  await tapWorld(site.x, site.y);
  await shot('site-selected');
  await clear();
  await setPaused(false);
  let done = null;
  for (let t = 0; t < 120 && !done; t++) {
    await page.waitForTimeout(400);
    done = await view((i) => { const b = window.__battleView().eco.buildings.find((x) => x.idx === i); return b?.built ? { x: b.x, y: b.y } : null; }, site.idx);
  }
  await setPaused(true);
  if (done) { await centre(done.x, done.y); await page.waitForTimeout(400); await tapWorld(done.x, done.y); await shot('barracks'); await clear(); }
}
await setPaused(true);

// A town tower tapped: its health bar on the field (filled) and the small card.
const tower = await view(() => { const v = window.__battleView(); const t = v.structures.find((s) => s.kind === 'tower' && s.alive) || v.structures[0]; return { x: t.x, y: t.y }; });
await centre(tower.x, tower.y); await page.waitForTimeout(400); await tapWorld(tower.x, tower.y); await shot('inspect-tower'); await clear();

// An infantry squad, then a laborer.
const inf = await view(() => { const q = window.__battleView().squads.find((s) => s.side === 0 && s.alive && s.onField && s.classId === 'infantry'); return q ? { x: q.x, y: q.y } : null; });
if (inf) { await centre(inf.x, inf.y); await page.waitForTimeout(400); await tapWorld(inf.x, inf.y); await shot('army'); await clear(); }
const wk = await view(() => { const q = window.__battleView().squads.find((s) => s.side === 0 && s.alive && s.onField && s.classId === 'worker'); return q ? { x: q.x, y: q.y } : null; });
if (wk) {
  await centre(wk.x, wk.y); await page.waitForTimeout(400); await tapWorld(wk.x, wk.y); await shot('worker');
  // Placement: a house, from the worker's build menu (or the old Build button).
  const opener = page.getByTestId('battle-build');
  if (await opener.count()) await opener.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const tile = page.getByTestId('build-house');
  if (await tile.count()) {
    await tile.click({ force: true });
    await page.waitForTimeout(300);
    // Good ground: right of the camp; blocked ground: the nearest forest / rock tile.
    const spots2 = await view(() => {
      const r = window.__battleRenderer; const v = window.__battleView(); const m = r.setup.map;
      const c = v.eco.buildings.find((b) => b.side === 0 && b.type === 'camp');
      const cx = Math.floor(c.x / 256); const cy = Math.floor(c.y / 256);
      let bad = null;
      for (let d = 3; d < 20 && !bad; d++) for (let dy = -d; dy <= d && !bad; dy++) for (let dx = -d; dx <= d && !bad; dx++) { const tx = cx + dx; const ty = cy + dy; if (tx < 7 || ty < 7 || tx > m.w - 8 || ty > m.h - 8) continue; const t = m.tiles[ty * m.w + tx]; if (t === 1 || t === 3) bad = { x: (cx + dx + 0.5) * 256, y: (cy + dy + 0.5) * 256 }; }
      return { good: { x: c.x + 5 * 256, y: c.y + 3 * 256 }, bad };
    });
    const ghostAt = async (pt) => {
      const p = await screenOf(pt.x, pt.y);
      if (touch) {
        // a touch drag positions the ghost (CDP touch events)
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x - 40, y: p.y }] });
        for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x - 40 + (40 * k) / 6, y: p.y }] }); await page.waitForTimeout(30); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else await page.mouse.move(Math.round(p.x), Math.round(p.y));
      await page.waitForTimeout(450);
    };
    await centre(spots2.good.x, spots2.good.y); await page.waitForTimeout(300);
    await ghostAt(spots2.good); await shot('place-ok');
    if (spots2.bad) { await centre(spots2.bad.x, spots2.bad.y); await page.waitForTimeout(300); await ghostAt(spots2.bad); await shot('place-bad'); }
  }
}

console.log(errors.length ? `console errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
