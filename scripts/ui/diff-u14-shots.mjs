// scripts/ui/diff-u14-shots.mjs
// Real-browser check of the Ruler tab (differentiation plan U14, U15) at 844x390 and 1280x800,
// English and Hebrew; screenshots into audits/diff-u14/. Needs a dev server of THIS checkout.
//   node scripts/ui/diff-u14-shots.mjs [--url http://localhost:5314/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5314/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/diff-u14');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^(Begin as|התחל)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // Give the ruler some renown so points and the Virtue tree show.
  await page.evaluate(async () => {
    const s = window.__game.state; const me = s.playerNationId;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], ruler: { ...s.nations[me].ruler, renown: 70, deeds: [{ turn: 3, id: 'cityFounded', renown: 15 }, { turn: 2, id: 'battleWon', renown: 5 }] }, ambitions: { ageId: 'stone', offers: [{ id: 'threeCities', base: 0 }, { id: 'lore', base: 0, done: 2 }], done: [] } } } } });
  });
  await wait(500);
  if (lang === 'he') {
    await click(page.getByTestId('landscape-rail').getByRole('button', { name: 'Menu' }));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await click(page.getByTestId('settings-language').getByTestId('lang-he'));
    await wait(600);
    await page.keyboard.press('Escape');
    await wait(400);
  }
  const rail = page.getByTestId('landscape-rail');
  await click(rail.getByRole('button', { name: /^(Ruler|שליט)$/ }));
  await page.getByTestId('ruler-sheet').waitFor({ timeout: 10000 });
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-1-sheet.png`) });
  await click(page.getByTestId('ruler-tree').locator('button').first());
  await wait(300);
  await page.getByTestId('ruler-detail').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${tag}-2-virtue.png`) });
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(`${tag}: no horizontal scroll`, !hs);
  const small = await page.getByTestId('ruler-sheet').locator('button').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43 || r.width < 40; }).length);
  check(`${tag}: every button is at least 44 px`, small === 0, `${small} small`);
  check(`${tag}: no page errors`, errors.length === 0, errors[0] || '');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone-en', { width: 844, height: 390 }, 'en');
await run(browser, 'phone-he', { width: 844, height: 390 }, 'he');
await run(browser, 'desktop-en', { width: 1280, height: 800 }, 'en');
await browser.close();
process.exit(failed ? 1 : 0);
