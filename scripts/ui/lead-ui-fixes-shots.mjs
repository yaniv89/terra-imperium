// Lead check fixes (28 Oct): the kingdoms era save at 844x390, 844x340 and 1600x900, en and he.
// Map, a blocked hire's "why" bubble, the Log sheet, a city sheet (legend), and a battle deploy in the sandbox.
//   npx vite --port 5197 &; node scripts/ui/lead-ui-fixes-shots.mjs [--tag after] [--url ...] [--out plans/ui/lead-ui-fixes]
// Prints one line per check with the boxes it compared.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, loadSlice, loadSlices } from '../ai/human-playtest.mjs';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg('--tag', 'after');
const url = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = arg('--out', 'plans/ui/lead-ui-fixes');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [['844x390', { width: 844, height: 390, mobile: true }], ['844x340', { width: 844, height: 340, mobile: true }], ['1600x900', { width: 1600, height: 900, mobile: false }]];
const saves = loadSlices(['kingdoms'], () => {});
const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
const boxOf = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } : null; }, sel);
const hit = (a, b) => !!(a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b);
let bad = 0;
const check = (name, ok, detail) => { if (!ok) bad += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
try {
  for (const [sz, size] of SIZES) for (const lang of ['en', 'he']) {
    const g = await openGame(browser, { size, lang, url });
    const { page } = g;
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${TAG}-${lang}-${sz}-${n}.jpg`), type: 'jpeg', quality: 70 });
    await loadSlice(g, saves.kingdoms);
    await shot('0-map');
    const rail = page.locator('nav').last().locator('button');
    // a blocked hire (200 gold, the save has less): its reason bubble
    await rail.first().click();
    await wait(800);
    const court = page.getByRole('button', { name: /Court|חצר/ }).first();
    if (await court.count()) { await court.click().catch(() => {}); await wait(500); }
    const blocked = page.locator('[aria-disabled="true"]').filter({ hasText: /200/ }).first();
    if (await blocked.count()) {
      await blocked.click();
      await wait(600);
      const tip = await boxOf(page, '[data-testid="why-tip"]');
      const dock = await boxOf(page, '[data-testid="turn-dock"]');
      check(`${lang} ${sz} why bubble clear of End Turn`, tip && !hit(tip, dock), JSON.stringify({ tip, dock }));
      await shot('1-why');
    } else console.log(`skip ${lang} ${sz}: no blocked 200 gold button found`);
    await page.keyboard.press('Escape');
    await rail.first().click();
    await wait(500);
    // the Log sheet: its last line ends above the turn dock
    await rail.nth(-2).click();
    await wait(1200);
    const scroller = await page.evaluate(() => { const els = [...document.querySelectorAll('.fixed.inset-0.z-40 *')].filter((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible'); const e = els[0]; if (!e) return null; e.scrollTop = e.scrollHeight; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; });
    await wait(300);
    const dock = await boxOf(page, '[data-testid="turn-dock"]');
    if (size.mobile) check(`${lang} ${sz} Log text ends above End Turn`, scroller && dock && scroller.b <= dock.t + 2, JSON.stringify({ scroller, dock }));
    await shot('2-log');
    await page.keyboard.press('Escape');
    await wait(500);
    // a city sheet: nothing of the legend shows beside it
    await rail.nth(2).click();
    await wait(600);
    const row = page.getByTestId('city-rail-row').first();
    if (await row.count()) {
      await row.click();
      await wait(1200);
      check(`${lang} ${sz} legend hidden while a city sheet is open`, (await page.locator('text=/each its own colour|כל אחד בצבעו/').count()) === 0);
      await shot('3-city');
    }
    console.log(`${lang} ${sz}: page errors ${g.errors.length}${g.errors.length ? `: ${g.errors.slice(0, 2).join(' / ')}` : ''}`);
    await g.ctx.close();
  }
  // battle deploy in the sandbox: the objective box clear of the deploy card
  for (const [sz, size] of SIZES.slice(0, 2)) for (const lang of ['en', 'he']) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
    await page.goto(`${url}?battleSandbox`);
    await page.locator('button').first().waitFor({ timeout: 120000 });
    await page.locator('button').first().dispatchEvent('click');
    await page.waitForSelector('[data-testid=battle-deploy-help]', { timeout: 300000 });
    await wait(1500);
    const a = await boxOf(page, '[data-testid="battle-status"]');
    const b = await boxOf(page, '[data-testid="battle-deploy-help"]');
    check(`${lang} ${sz} battle objective box clear of the deploy card`, a && b && !hit(a, b), JSON.stringify({ a, b }));
    await page.screenshot({ path: path.join(OUT, `${TAG}-${lang}-${sz}-4-deploy.jpg`), type: 'jpeg', quality: 70 });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exitCode = bad ? 1 : 0;
