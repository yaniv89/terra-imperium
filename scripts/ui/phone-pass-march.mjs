// scripts/ui/phone-pass-march.mjs
// The phone pass: choosing a march, then opening a rail tab. The march bar used to draw over the
// tab's header; now it waits as a chip. One shot per size and language into --out.
//   node scripts/ui/phone-pass-march.mjs [--url http://localhost:5197/terra-imperium/] [--out dir] [--swgl]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/phone-pass'));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

for (const [h, lang] of [[390, 'en'], [340, 'he']]) {
  const id = `844x${h}-${lang}`;
  if (ONLY.length && !ONLY.includes(id)) continue;
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.locator('input').first().fill('Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-ready'));
  await click(page.getByTestId('begin-game'));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(2500);
  const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
  if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
  const advisor = page.getByTestId('research-let-advisor');
  if (await advisor.isVisible().catch(() => false)) await click(advisor);
  const idle = page.getByTestId('idle-chip'); const found = page.getByTestId('found-city');
  for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle).catch(() => {}); await wait(600); }
  if (await found.isVisible().catch(() => false)) { await click(found); await wait(1500); }
  for (let i = 0; i < 3; i++) { const c = page.locator('button[aria-label="Close"]:visible').first(); if (await c.count()) await click(c); await wait(200); }
  let tile = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.units).find((u) => u.ownerId === s.playerNationId && u.tile != null)?.tile; });
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:select-army', { detail: t })), tile);
  await wait(900);
  await click(page.getByTestId('army-march'));
  await wait(900);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: 'ruler' })));
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, `${id}-march-then-tab.png`) });
  const bar = await page.getByTestId('march-bar').count();
  const chip = await page.getByTestId('march-chip').count();
  console.log(`${id}: march bar on screen ${bar ? 'yes' : 'no'}, march chip ${chip ? 'yes' : 'no'}`);
  if (chip) {
    await click(page.getByTestId('march-chip'));
    await wait(1000);
    await page.screenshot({ path: path.join(OUT, `${id}-march-chip-back.png`) });
    console.log(`${id}: after the chip, march bar ${await page.getByTestId('march-bar').count() ? 'back' : 'missing'}`);
  }
  // A tap on the army's own hex (the soldier model, not the banner) opens the army card; a second tap is the tile.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await wait(200); }
  for (let i = 0; i < 4; i++) { const c = page.locator('button[aria-label="Close"]:visible, button[aria-label="Cancel march"]:visible, button[aria-label="ביטול הצעידה"]:visible').first(); if (await c.count()) await click(c); await wait(250); }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
  await wait(800);
  // Move the army one hex out of its town, into open country (the playtest's case).
  tile = await page.evaluate(async (t) => {
    const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const T = getTiles(); const s = window.__game.state;
    const nb = [...(T.neighbors[t] || [])];
    const centres = new Set(Object.values(s.regions).map((r) => r.tile));
    // two or three hexes out, on land no city holds, clear of the town's banner
    const own = s.world?.tileOwner || {};
    const ring2 = [...new Set(nb.flatMap((n) => [...(T.neighbors[n] || [])].flatMap((m) => [m, ...(T.neighbors[m] || [])])))];
    const to = ring2.find((n) => n !== t && !nb.includes(n) && T.land[n] === 1 && !centres.has(n) && !own[n]) ?? nb.find((n) => T.land[n] === 1 && !centres.has(n));
    const units = Object.fromEntries(Object.entries(s.units).map(([k, u]) => [k, u.tile === t && u.ownerId === s.playerNationId && u.classId !== 'settler' ? { ...u, tile: to } : u]));
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units } });
    return to;
  }, tile);
  await wait(1500);
  const at = await page.evaluate(async (t) => {
    const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const ll = getTiles().latLonOf(t); const lat = ll.lat ?? ll[0]; const lon = ll.lon ?? ll.lng ?? ll[1];
    const p = window.__map2DTest.project(lat, lon); const r = document.querySelector('[data-testid="flat-map"]').getBoundingClientRect();
    return { x: p.x + r.left, y: p.y + r.top, pick: window.__map2DTest.pickAt(p.x, p.y) };
  }, tile);
  await page.mouse.click(at.x, at.y);
  await wait(1200);
  const sheet = await page.getByTestId('army-sheet').isVisible().catch(() => false);
  const march = await page.getByTestId('army-march').isVisible().catch(() => false);
  await page.screenshot({ path: path.join(OUT, `${id}-tap-army-hex.png`) });
  console.log(`${id}: tap on the army hex (picks ${JSON.stringify(at.pick)}): army card ${sheet ? 'open' : 'not open'}, March ${march ? 'in view' : 'not in view'}`);
  if (march) {
    const b = await page.getByTestId('army-march').boundingBox();
    console.log(`${id}: March button ${Math.round(b.y)}..${Math.round(b.y + b.height)} of ${h}`);
  }
  await page.mouse.click(at.x, at.y);
  await wait(1200);
  console.log(`${id}: second tap: tile sheet ${await page.getByTestId('tile-yields').isVisible().catch(() => false) ? 'open' : 'not open'}`);
  await browser.close();
}
