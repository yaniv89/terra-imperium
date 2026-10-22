// scripts/ui/diff-u43-shots.mjs
// Real-browser check of the Explore mode option (U43) at 844x390 and 1600x900, en and he.
//   node scripts/ui/diff-u43-shots.mjs [--url http://localhost:5197/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/game/diff-u43');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok) => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-rules').dispatchEvent('click');
  await page.getByTestId('explore-toggle').waitFor({ timeout: 10000 });
  await page.getByTestId('explore-toggle').scrollIntoViewIfNeeded();
  await click(page.getByTestId('explore-toggle'));
  await wait(300);
  check(`${tag}: toggle on`, (await page.getByTestId('explore-toggle').getAttribute('aria-checked')) === 'true');
  await page.screenshot({ path: path.join(OUT, `${tag}-1-option.jpg`), type: 'jpeg', quality: 70 });
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${tag}-2-ready.jpg`), type: 'jpeg', quality: 70 });
  await click(page.getByRole('button', { name: /^(Begin as|מתחילים כ)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  check(`${tag}: game has explore on`, await page.evaluate(() => window.__game.state.settings?.explore === true));
  check(`${tag}: no page errors`, errors.length === 0);
  if (errors[0]) console.log(errors[0]);
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
for (const lang of ['en', 'he']) {
  await run(browser, `phone-${lang}`, { width: 844, height: 390 }, lang);
  await run(browser, `desktop-${lang}`, { width: 1600, height: 900 }, lang);
}
await browser.close();
process.exit(failed ? 1 : 0);
