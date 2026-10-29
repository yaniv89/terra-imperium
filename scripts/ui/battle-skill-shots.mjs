// scripts/ui/battle-skill-shots.mjs
// Real-browser check of the battle difficulty (lane battle-skill-8): the start screen's Rules step and the
// settings sheet at 844x390 and 1600x900, English and Hebrew; the pick reaches state.battleSettings.
// Screenshots into audits/battle-skill/. Needs a dev server of THIS checkout.
//   node scripts/ui/battle-skill-shots.mjs [--url http://localhost:5231/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5231/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/battle-skill');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-rules'));
  await page.getByTestId('battle-difficulty-normal').waitFor({ timeout: 10000 });
  check(`${tag}: Normal is the default`, await page.getByTestId('battle-difficulty-normal').getAttribute('aria-pressed') === 'true');
  await click(page.getByTestId('battle-difficulty-easy'));
  await page.getByTestId('battle-difficulty-easy').scrollIntoViewIfNeeded();
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${tag}-1-start.png`) });
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  check(`${tag}: the start pick reaches the game`, await page.evaluate(() => window.__game.state.battleSettings.difficulty) === 'easy');
  await wait(1500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-settings'))); // uiEvents.js openSettings
  await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
  await click(page.getByTestId('settings-battle-difficulty-hard'));
  await wait(300);
  await page.getByTestId('settings-battle-difficulty-hard').scrollIntoViewIfNeeded();
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${tag}-2-settings.png`) });
  check(`${tag}: settings sets Hard`, await page.evaluate(() => window.__game.state.battleSettings.difficulty) === 'hard');
  const box = await page.getByTestId('settings-battle-difficulty-hard').boundingBox();
  check(`${tag}: Hard button on screen and tall enough`, !!box && box.y >= 0 && box.y + box.height <= viewport.height && box.height >= 32, JSON.stringify(box));
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(`${tag}: no horizontal scroll`, !hs);
  check(`${tag}: no page errors`, errors.length === 0, errors[0] || '');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone-en', { width: 844, height: 390 }, 'en');
await run(browser, 'phone-he', { width: 844, height: 390 }, 'he');
await run(browser, 'desktop-en', { width: 1600, height: 900 }, 'en');
await run(browser, 'desktop-he', { width: 1600, height: 900 }, 'he');
await browser.close();
process.exit(failed ? 1 : 0);
