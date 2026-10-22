// scripts/ui/rank-7-11-shots.mjs
// Report ranks 7 and 11: the city's Auto build switch (Build tab) and the free law change (chip,
// Domestic > Laws), at 844x390 and 1600x900 in English and Hebrew. Shots into plans/ui/rank-7-11/.
// Needs a dev server of THIS checkout (`npx vite --port 5197`) and Chrome.
//   node scripts/ui/rank-7-11-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/rank-7-11');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [['phone', 844, 390, true], ['desktop', 1600, 900, false]];
const CHIP = { en: 'Free law change', he: 'שינוי חוק בחינם' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [label, w, h, mobile] of SIZES) for (const lang of ['en', 'he']) {
  const tag = `${lang}-${label}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE, { timeout: 300000 });
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE, { timeout: 300000 });
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label], input[type="text"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /Skip|דלג|דילוג/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.evaluate(() => {
    const g = window.__game; const me0 = g.state.playerNationId;
    const band = Object.values(g.state.units).find((u) => u.ownerId === me0 && (u.classId === 'settler' || u.classId === 'band' || u.band));
    if (band && !Object.values(g.state.regions).some((c) => c.owner === me0)) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
  });
  await wait(1500);
  // An age just advanced (the free law change) and nothing in production (End Turn opens Build).
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { ...(c.production || {}), current: null, queue: [], progress: 0 } } : c]));
    const r = s.research || {};
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, nations: { ...s.nations, [me]: { ...s.nations[me], freeLawChange: true } }, research: { ...r, current: r.current || Object.keys(r.progress || {})[0] || 'science_cuneiform_records', queue: [], auto: false } } });
  });
  await wait(800);
  const chip = page.getByText(CHIP[lang], { exact: true }).first();
  check(`${tag} free law chip shows`, await chip.isVisible().catch(() => false));
  await page.screenshot({ path: path.join(OUT, `${tag}-chip.png`) });
  if (await chip.isVisible().catch(() => false)) {
    await click(chip); await wait(1200);
    const note = page.getByTestId('law-free');
    check(`${tag} laws open with the free line`, await note.isVisible().catch(() => false));
    await note.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${tag}-laws.png`) });
    await page.keyboard.press('Escape'); await wait(400);
  }
  await click(page.getByTestId('end-turn'));
  await page.getByTestId('city-tab-build').waitFor({ timeout: 10000 }).catch(() => {});
  await wait(800);
  const sw = page.getByTestId('city-auto-build-toggle');
  check(`${tag} auto build switch shows, off on the capital`, (await sw.getAttribute('aria-pressed').catch(() => null)) === 'false');
  const bb = await sw.boundingBox().catch(() => null);
  check(`${tag} switch is a 44 px target inside the screen`, !!bb && bb.height >= 44 && bb.x >= 0 && bb.x + bb.width <= w, JSON.stringify(bb));
  await page.screenshot({ path: path.join(OUT, `${tag}-build-off.png`) });
  await click(sw); await wait(500);
  check(`${tag} the switch turns on`, (await sw.getAttribute('aria-pressed').catch(() => null)) === 'true');
  await page.screenshot({ path: path.join(OUT, `${tag}-build-on.png`) });
  check(`${tag} no page errors`, !errors.length, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
