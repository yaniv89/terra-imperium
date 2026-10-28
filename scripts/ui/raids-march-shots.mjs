// scripts/ui/raids-march-shots.mjs
// Lane raids-march: a march to attack shows the target's known garrison and Auto's odds before it
// starts (playtest 40651416284 step 286, "March to Zafar"). A fresh game, the nearest independent city
// gets a big garrison and the player intel on it, one regiment at the capital; then the march bar
// aimed at it, and the city card's "March on" button. 844x390 and 1600x900, en and he, into --out.
//   node scripts/ui/raids-march-shots.mjs [--url http://localhost:5197/terra-imperium/] [--out dir]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'plans/ui/raids-march'));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;

for (const [w, h] of [[844, 390], [1600, 900]]) {
  for (const lang of ['en', 'he']) {
    const id = `${w}x${h}-${lang}`;
    const browser = await launchBrowser({ executablePath: CHROME, headless: true });
    const phone = w < 1000;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
    await page.goto(URL_BASE);
    await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, lang);
    await page.goto(URL_BASE);
    await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
    await click(page.locator('[data-people]').first());
    await click(page.getByTestId('start-step-ready'));
    await click(page.getByTestId('begin-game'));
    await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
    await wait(2500);
    const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
    if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
    const advisor = page.getByTestId('research-let-advisor');
    if (await advisor.isVisible().catch(() => false)) await click(advisor);
    // Found the first city (a Dawn start is a settler).
    const idle = page.getByTestId('idle-chip'); const found = page.getByTestId('found-city');
    for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle).catch(() => {}); await wait(600); }
    if (await found.isVisible().catch(() => false)) { await click(found); await wait(1500); }
    for (let i = 0; i < 3; i++) { const c = page.locator('button[aria-label="Close"]:visible').first(); if (await c.count()) await click(c); await wait(200); }
    // The setup: the nearest independent city far from the capital, 30 regiments in it, intel on it.
    const setup = await page.evaluate(async () => {
      const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
      const T = getTiles(); const s = window.__game.state; const me = s.playerNationId;
      const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
      const dist = (a, b) => { const p = T.latLonOf(a); const q = T.latLonOf(b); const la = (x) => x.lat ?? x[0]; const lo = (x) => x.lon ?? x.lng ?? x[1]; return Math.hypot(la(p) - la(q), lo(p) - lo(q)); };
      const target = Object.values(s.regions).filter((r) => s.nations[r.owner]?.kind === 'independent' && r.tile != null)
        .sort((a, b) => dist(a.tile, cap.tile) - dist(b.tile, cap.tile))[0];
      const units = { ...s.units };
      const reg = (uid, owner, rid, tile) => ({ id: uid, ownerId: owner, regionId: rid, homeRegionId: rid, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
      for (let i = 0; i < 30; i++) units[`shot_g${i}`] = reg(`shot_g${i}`, target.owner, target.id, target.tile);
      units.shot_army = reg('shot_army', me, capId, cap.tile);
      window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units, intel: { ...(s.intel || {}), [target.owner]: 9999 } } });
      return { from: capId, target: target.id, name: target.name };
    });
    await wait(1500);
    await page.evaluate(({ from, target }) => window.dispatchEvent(new CustomEvent('ti:start-march', { detail: { from, naval: false, unitIds: ['shot_army'], target } })), setup);
    await wait(2000);
    await page.screenshot({ path: path.join(OUT, `${id}-march-bar.png`) });
    const odds = await page.getByTestId('march-odds').textContent().catch(() => null);
    const hopeless = await page.getByTestId('march-odds').getAttribute('data-hopeless').catch(() => null);
    const ok = !!odds && hopeless !== null && !/[{}]|NaN/.test(odds);
    if (!ok) failed += 1;
    console.log(`${id}: target ${setup.name}; march odds line ${ok ? 'OK' : 'MISSING'}: ${odds}`);
    // The city card's "March on" button carries the same line.
    const cancel = page.locator('button[aria-label="Cancel march"]:visible, button[aria-label="ביטול הצעידה"]:visible').first();
    if (await cancel.count()) await click(cancel);
    await wait(500);
    await page.evaluate((rid) => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: rid })), setup.target);
    await wait(2000);
    const card = await page.evaluate(() => document.body.innerText);
    const onCard = /Auto takes it|האוטומטי כובש/.test(card);
    console.log(`${id}: city card odds ${onCard ? 'shown' : 'not shown'}`);
    await page.screenshot({ path: path.join(OUT, `${id}-city-card.png`) });
    if (errors.length) { failed += 1; console.log(`${id}: page errors: ${errors.join(' | ')}`); }
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
