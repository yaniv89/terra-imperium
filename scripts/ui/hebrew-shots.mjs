// scripts/ui/hebrew-shots.mjs
// A real-browser check of phase H0 (plans/hebrew-support-plan.md): the language switch on the start
// steps, the title screen and the Menu card (Settings), in English and Hebrew at 844x390 and 844x340.
// Needs a dev server of THIS checkout (`npx vite --port 5198`). Screenshots go to plans/ui/h0/.
//   node scripts/ui/hebrew-shots.mjs [--url http://localhost:5198/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve('plans/ui/h0');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };
const docState = (page) => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, fonts: !!document.getElementById('i18n-hebrew-fonts'), bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 40), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }));

const run = async (H) => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (name) => { await wait(600); await page.screenshot({ path: path.join(OUT, `${name}-${H}.png`), timeout: 120000 }); };

  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  check(`${H}: English by default`, (await docState(page)).lang === 'en');
  await shot('start-en');
  // Switch on the start steps: applies at once, no reload.
  await click(page.getByTestId('lang-he'));
  await wait(500);
  const heState = await docState(page);
  check(`${H}: Hebrew switch sets lang and dir at once`, heState.lang === 'he' && heState.dir === 'rtl', JSON.stringify(heState));
  check(`${H}: Hebrew fonts link injected`, heState.fonts);
  await shot('start-he');
  await click(page.getByTestId('lang-en'));
  await wait(300);
  check(`${H}: back to English`, (await docState(page)).dir === 'ltr');

  // Begin a game (English), open Menu.
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await click(page.getByTestId('landscape-rail').getByRole('button', { name: 'Menu' }));
  await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
  await shot('menu-en');
  await click(page.getByTestId('settings-language').getByTestId('lang-he'));
  await wait(600);
  check(`${H}: Menu switch changes the Menu card at once`, (await page.getByTestId('settings-sheet').innerText()).includes('הגדרות'));
  await shot('menu-he');
  // scroll the sheet to the bottom to see the last sections in Hebrew
  await page.getByTestId('settings-sheet').locator('div.overflow-y-auto').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await shot('menu-he-bottom');
  await click(page.getByTestId('settings-language').getByTestId('lang-en'));
  await wait(300);
  await click(page.getByTestId('settings-language').getByTestId('lang-he'));
  await page.keyboard.press('Escape');
  await wait(1500); // the autosave

  // Reload: the title screen, in Hebrew (the choice was saved).
  await page.goto(URL_BASE);
  await page.getByTestId('title-screen').waitFor({ timeout: 120000 });
  const t = await docState(page);
  check(`${H}: the choice is remembered after a reload`, t.lang === 'he' && t.dir === 'rtl', JSON.stringify(t));
  const titleText = await page.getByTestId('title-screen').innerText();
  const latinInCard = (await page.getByTestId('title-continue-card').innerText()).match(/[A-Za-z]{2,}/g);
  check(`${H}: the Continue card has no Latin letters in Hebrew`, !latinInCard, JSON.stringify(latinInCard));
  check(`${H}: title text is Hebrew`, titleText.includes('המשך'));
  check(`${H}: no sideways page scroll on the title screen`, !t.hscroll);
  await shot('title-he');
  await click(page.getByTestId('lang-en'));
  await wait(400);
  check(`${H}: title in English again`, (await page.getByTestId('title-screen').innerText()).includes('Continue'));
  await shot('title-en');
  await click(page.getByTestId('lang-he'));
  await click(page.getByTestId('title-load'));
  await page.getByTestId('title-load-view').waitFor();
  await shot('title-load-he');
  check(`${H}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
};

for (const H of [390, 340]) await run(H);
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
