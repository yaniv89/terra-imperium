// scripts/ui/diff-u30-u32-shots.mjs
// Real-browser check of the glossary (U30) and the crisis banner (U32) at 844x390 and 1600x900.
//   node scripts/ui/diff-u30-u32-shots.mjs [--url http://localhost:5330/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5330/terra-imperium/');
const OUT = path.resolve('plans/game/diff-u30-u32');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok) => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

const run = async (browser, tag, viewport) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-rules').dispatchEvent('click');
  await page.getByTestId('crises-toggle').waitFor({ timeout: 10000 });
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${tag}-1-start-option.jpg`), type: 'jpeg', quality: 70 });
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^(Begin as|התחל)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.evaluate(() => {
    const s = window.__game.state;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, crises: { last: {}, lastAny: s.turnNumber, history: [{ id: 'great_plague', turn: s.turnNumber, nations: [s.playerNationId, 'x'] }] } } });
  });
  // On a phone the notice waits as a chip behind the research prompt; a tap brings it up.
  await wait(800);
  const chip = page.getByTestId('crisis-banner-chip');
  if (await chip.isVisible().catch(() => false)) { await click(chip); await wait(600); }
  if (!(await page.getByTestId('crisis-banner').isVisible().catch(() => false))) { await click(page.getByRole('button', { name: /^Later/ }).first()); await wait(800); } // a desktop keeps the chip until the research card is closed
  await page.getByTestId('crisis-banner').waitFor({ timeout: 10000 }).catch(() => {});
  check(`${tag}: crisis banner shows`, await page.getByTestId('crisis-banner').isVisible().catch(() => false));
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-2-crisis-banner.jpg`), type: 'jpeg', quality: 70 });
  const peopleId = await page.evaluate(() => window.__game.state.playerNationId);
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('ti:open-glossary', { detail: { kind: 'people', id } })), peopleId);
  await page.getByTestId('glossary-sheet').waitFor({ timeout: 10000 });
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${tag}-3-glossary-people.jpg`), type: 'jpeg', quality: 70 });
  await click(page.getByTestId('glossary-sheet').getByTestId('glossary-link').first());
  await wait(300);
  check(`${tag}: tapping a city opens its entry`, /city of|first city of/i.test(await page.getByTestId('glossary-sheet').innerText()));
  await page.screenshot({ path: path.join(OUT, `${tag}-4-glossary-city.jpg`), type: 'jpeg', quality: 70 });
  check(`${tag}: no page errors`, errors.length === 0);
  if (errors[0]) console.log(errors[0]);
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
await run(browser, 'phone', { width: 844, height: 390 });
await run(browser, 'desktop', { width: 1600, height: 900 });
await browser.close();
process.exit(failed ? 1 : 0);
