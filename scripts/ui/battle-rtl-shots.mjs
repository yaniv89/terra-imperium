// Battle screens in English and Hebrew (right to left HUD), 844x390 and 844x340. Phase H2.
//   node scripts/ui/battle-rtl-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out plans/ui/h2]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const OUT = path.resolve(arg('--out', 'plans/ui/h2'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const H of [390, 340]) for (const lang of ['en', 'he']) {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(`${URL_BASE}?battleSandbox`);
  await wait(2500);
  await page.getByRole('button', { name: 'Fight' }).dispatchEvent('click');
  await wait(9000);
  await page.screenshot({ path: path.join(OUT, `battle-${lang}-${H}.png`), timeout: 120000 });
  const pause = page.getByTestId('battle-pause');
  if (await pause.count()) { await pause.dispatchEvent('click'); await wait(800); await page.screenshot({ path: path.join(OUT, `battle-paused-${lang}-${H}.png`), timeout: 120000 }); }
  console.log(lang, H, errors.length ? errors.slice(0, 2).join(' | ') : 'no page errors');
  await browser.close();
}
