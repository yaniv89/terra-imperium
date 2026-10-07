// scripts/ui/battle-ux-shots.mjs
// Screenshots for the battle UX pass (plans/UI-DESIGN.md section 8, B09) in a real browser, against a
// running dev server (npx vite --port 5199 --strictPort):
//   node scripts/ui/battle-ux-shots.mjs <outDir> [--w 844 --h 390] [--only morale,inspect,build,site]
//   morale   the player's army thrown at the town until one of its squads is beaten down (routed on
//            the old rule, Shaken on the new), that squad selected
//   inspect  an enemy building tapped (the info card)
//   build    the build menu open, a disabled tile held for its detail
//   site     a building going up (its HP bar rising), selected
// Uses the DEV-only hooks window.__battleRenderer, __battleView and __battleOrders (TacticalBattleScreen.jsx).
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'plans/ui/battle-ux/after';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const only = opt('only', 'morale,inspect,build,site').split(',');
const tag = `${W}x${H}`;
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const errors = [];
const open = async (query = '') => {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 900 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  try { await page.addInitScript(() => { try { localStorage.setItem('ti.hint.battleControls', '1'); } catch { /* blocked */ } }); } catch { /* old */ }
  await page.goto(`${base}?battleSandbox&autostart&age=bronze${query}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
  return page;
};
const shot = async (page, name) => { const file = path.join(outDir, `${name}-${tag}.png`); await page.screenshot({ path: file }); console.log('saved', file); };
const startFast = async (page) => {
  await page.getByTestId('battle-pause').click(); // Start
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^1×$/.test(x.textContent.trim())); b?.click(); b?.click(); });
};
const pause = async (page) => {
  await page.locator('[data-testid="battle-pause"][aria-label="Pause"]').click();
  await page.getByTestId('battle-pause-orders').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
};
// Tap / click at a point of the battlefield in sim units.
const tapWorld = async (page, x, y) => {
  const p = await page.evaluate(([sx, sy]) => window.__battleRenderer.worldToScreen(sx / 256, sy / 256), [x, y]);
  console.log("tap", Math.round(p.x), Math.round(p.y));
  if (W < 900) await page.touchscreen.tap(Math.round(p.x), Math.round(p.y)); else await page.mouse.click(Math.round(p.x), Math.round(p.y));
  await page.waitForTimeout(400);
};

if (only.includes('morale')) {
  const page = await open('&noeco');
  await startFast(page);
  // Everything at the keep, so some squad is beaten down.
  await page.evaluate(() => { const v = window.__battleView(); const k = v.structures[0]; window.__battleOrders([{ side: 0, type: 'attackMove', squads: v.squads.filter((q) => q.side === 0 && q.onField).map((q) => q.idx), x: k.x - 2 * 256, y: k.y }]); });
  let hit = null;
  for (let t = 0; t < 240 && !hit; t++) {
    await page.waitForTimeout(500);
    hit = await page.evaluate(() => { const v = window.__battleView(); const q = v.squads.find((s) => s.side === 0 && s.alive && s.onField && !s.fled && (s.routed || s.morale <= 20)); return q ? { idx: q.idx, routed: q.routed, morale: q.morale } : null; });
  }
  console.log('beaten squad', JSON.stringify(hit));
  if (hit) {
    // A routed squad is shown as the alert sees it; then selected.
    await page.waitForTimeout(1200);
    await pause(page);
    await page.evaluate((i) => { const q = window.__battleView().squads[i]; window.__battleRenderer.centerOn(q.x / 256, q.y / 256); }, hit.idx);
    await page.waitForTimeout(500);
    await shot(page, 'morale-alert');
    const q = await page.evaluate((i) => { const s = window.__battleView().squads[i]; return { x: s.x, y: s.y }; }, hit.idx);
    await tapWorld(page, q.x, q.y);
    await shot(page, 'morale-selected');
  }
  await page.close();
}

if (only.includes('inspect')) {
  const page = await open();
  await page.evaluate(() => { const k = window.__battleView().structures[0]; window.__battleRenderer.centerOn(k.x / 256 - 3, k.y / 256); });
  await page.waitForTimeout(600);
  const target = await page.evaluate(() => { const v = window.__battleView(); const t = v.structures.find((s) => s.kind === 'tower' && s.alive) || v.structures[0]; return { x: t.x, y: t.y }; });
  await tapWorld(page, target.x, target.y);
  await shot(page, 'inspect-tower');
  const keep = await page.evaluate(() => { const k = window.__battleView().structures[0]; return { x: k.x, y: k.y }; });
  await tapWorld(page, keep.x, keep.y);
  await shot(page, 'inspect-keep');
  await page.close();
}

if (only.includes('build') || only.includes('site')) {
  const page = await open();
  await startFast(page);
  if (only.includes('site')) {
    // A barracks next to the camp, built by the starting laborers.
    // Try spots round the camp one at a time until a site goes up.
    const spots = [];
    for (const r of [6, 9, 12]) for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) spots.push([dx * r, dy * r]);
    for (const [dx, dy] of spots) {
      const placed = await page.evaluate(([ox, oy]) => {
        const v = window.__battleView(); const camp = v.eco.buildings.find((b) => b.type === 'camp');
        if (v.eco.buildings.some((b) => b.side === 0 && b.type === 'barracks')) return true;
        const workers = v.squads.filter((q) => q.side === 0 && q.classId === 'worker').map((q) => q.idx);
        window.__battleOrders([{ side: 0, type: 'build', squads: workers.slice(0, 3), building: 'barracks', tx: Math.floor(camp.x / 256) + ox - 1, ty: Math.floor(camp.y / 256) + oy - 1 }]);
        return false;
      }, [dx, dy]);
      if (placed) break;
      await page.waitForTimeout(250);
    }
    let site = null;
    for (let t = 0; t < 60 && !site; t++) {
      await page.waitForTimeout(500);
      site = await page.evaluate(() => { const b = window.__battleView().eco.buildings.find((x) => x.side === 0 && !x.built && x.alive && x.progress >= 25); return b ? { x: b.x, y: b.y, progress: b.progress, hp: b.hp, maxHp: b.maxHp } : null; });
    }
    console.log('site', JSON.stringify(site));
    await pause(page);
    if (site) {
      await page.evaluate((s) => { window.__battleRenderer.zoomBy(1.6); window.__battleRenderer.centerOn(s.x / 256, s.y / 256); }, site);
      await page.waitForTimeout(500);
      await tapWorld(page, site.x, site.y);
      await shot(page, 'site-selected');
    }
  } else await pause(page);
  if (only.includes('build')) {
    await page.keyboard.press('Escape');
    // B10: the build grid is a laborer's context panel: select one (Idle, else tap a laborer).
    const idle = page.getByTestId('battle-idle-workers');
    if (await idle.count()) await idle.click({ force: true });
    else {
      const wk = await page.evaluate(() => { const q = window.__battleView().squads.find((s) => s.side === 0 && s.alive && s.onField && s.classId === 'worker'); if (q) window.__battleRenderer.centerOn(q.x / 256, q.y / 256); return q ? { x: q.x, y: q.y } : null; });
      if (wk) { await page.waitForTimeout(400); await tapWorld(page, wk.x, wk.y); }
    }
    await page.waitForTimeout(400);
    await shot(page, 'build-menu');
    // Hold a tile for its detail (the first disabled one, else the tower).
    const tile = page.locator('[data-testid^="build-"][aria-disabled="true"]').first();
    const target = (await tile.count()) ? tile : page.getByTestId('build-tower');
    const box = await target.boundingBox();
    if (box) {
      if (W < 900) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(700); await shot(page, 'build-detail'); await page.mouse.up(); } else { await target.hover(); await page.waitForTimeout(700); await shot(page, 'build-detail'); }
    }
  }
  await page.close();
}

console.log(errors.length ? `console errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
