// scripts/ui/era-goals-shots.mjs
// Follow-up 24: the era goals and their rewards on every surface that shows them (the map tracker,
// Research, the nation overview, Legacy) at 844x390 and 1600x900, English and Hebrew, into
// plans/ui/era-goals/. The player is put in the Bronze Age (four goals: no War goal yet) with one
// goal paid. Needs a dev server of this checkout (`npx vite --port 5263`) and a Chrome.
//   node scripts/ui/era-goals-shots.mjs [--url http://localhost:5263/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { foundFirstCity } from '../../e2e/startHelpers.js';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5263/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/era-goals');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const BRONZE = async () => {
  const { withAgesResearched } = await import('/terra-imperium/src/engine/research.js');
  let s = window.__game.state;
  const me = s.playerNationId;
  s = withAgesResearched(s, me, 'bronze');
  s = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], eraGoals: { bronze: { met: ['science'] } } } } };
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
};

const run = async (browser, name, viewport, mobile, he = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await foundFirstCity(page);
  await page.keyboard.press('Escape');
  await page.evaluate(BRONZE);
  if (he) await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'));
  await wait(1500);
  const shot = (what) => page.screenshot({ path: path.join(OUT, `${name}-${what}.jpg`), type: 'jpeg', quality: 80, timeout: 120000 });
  const noPlaceholder = async (what) => { const txt = await page.evaluate(() => document.body.innerText); check(`${name} ${what}: no raw placeholder or NaN`, !/\{[a-z]+\}|NaN/.test(txt)); };

  await click(page.getByTestId('goal-tracker-chip'));
  await page.getByTestId('goal-tracker').waitFor({ timeout: 10000 });
  check(`${name}: tracker shows the four Bronze goals`, (await page.getByTestId('goal-tracker').locator('[data-testid^="goal-"]').count()) === 4);
  await noPlaceholder('tracker'); await shot('tracker');
  await click(page.getByTestId('goal-tracker-chip'));

  for (const [tab, testId] of [['tech', 'research-era-goals'], ['legacy', 'era-goals']]) {
    await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: t })), tab);
    const box = page.getByTestId(testId);
    await box.waitFor({ timeout: 15000 }).catch(() => {});
    await box.scrollIntoViewIfNeeded().catch(() => {});
    check(`${name}: ${testId} visible`, await box.isVisible().catch(() => false));
    await noPlaceholder(testId); await shot(testId);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
    await wait(600);
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-nation-overview')));
  const card = page.getByTestId('nation-era-goals');
  await card.waitFor({ timeout: 15000 }).catch(() => {});
  await card.scrollIntoViewIfNeeded().catch(() => {});
  check(`${name}: nation-era-goals visible`, await card.isVisible().catch(() => false));
  await noPlaceholder('nation'); await shot('nation-era-goals');
  check(`${name}: no page errors`, errors.length === 0, errors[0]);
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', { width: 844, height: 390 }, true);
await run(browser, 'phone-he', { width: 844, height: 390 }, true, true);
await run(browser, 'desktop', { width: 1600, height: 900 }, false);
await run(browser, 'desktop-he', { width: 1600, height: 900 }, false, true);
await browser.close();
process.exit(failed ? 1 : 0);
