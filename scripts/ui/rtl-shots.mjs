// scripts/ui/rtl-shots.mjs
// A real-browser check of phase H1 (plans/hebrew-support-plan.md): the campaign layout in English
// and in Hebrew (right to left) at 844x390, 844x340 and desktop. Starts a game, then shoots the
// play screen, an open rail tab, the Menu, the city rail/sheet and the diplomacy tab.
// Needs a dev server of THIS checkout (`npx vite --port 5198`).
//   node scripts/ui/rtl-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out plans/ui/h1] [--tag after]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const TAG = arg('--tag', 'after');
const OUT = path.resolve(arg('--out', 'plans/ui/h1'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const SIZES = [['390', 844, 390, true], ['340', 844, 340, true], ['desk', 1280, 800, false]];

const run = async ([label, W, H, mobile], lang) => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (name) => { await wait(700); await page.screenshot({ path: path.join(OUT, `${TAG}-${lang}-${label}-${name}.png`), timeout: 120000 }); };
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await shot('start');
  await page.fill('input[aria-label], input[type="text"]', lang === 'he' ? 'Akkad' : 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.locator('button', { hasText: /^Begin as/ }).last());
  const skip = page.getByRole('button', { name: /Skip|דלג/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const research = page.getByTestId('research-choice');
  if (await research.isVisible().catch(() => false)) { await click(page.getByTestId('research-let-advisor')); await wait(600); }
  await shot('play');
  const rail = page.getByTestId('landscape-rail');
  if (await rail.count()) {
    const buttons = rail.locator('nav button');
    const n = await buttons.count();
    if (n > 1) { await click(buttons.nth(1)); await wait(500); await shot('tab1'); }
    if (n > 1) {
      const kish = page.getByTestId('landscape-dock').getByText('Kish').first();
      if (await kish.count()) { await click(kish); await wait(900); await shot('city'); await page.keyboard.press('Escape'); await wait(300); }
    }
    if (n > 3) { await click(buttons.nth(3)); await wait(500); await shot('tab3'); }
    await click(rail.locator('nav button').last());
    await wait(500);
    await shot('menu');
    await page.keyboard.press('Escape');
  }
  console.log(`${lang} ${label}: ${errors.length ? errors.slice(0, 2).join(' | ') : 'no page errors'}`);
  await browser.close();
};

for (const size of SIZES) for (const lang of ['en', 'he']) await run(size, lang);
