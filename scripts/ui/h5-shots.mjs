// Battle screens in Hebrew, state by state (phase H5), at 844x390 and 844x340:
// the pause sheet, the abilities sheet, the build sheet, the retreat card, the result screen.
//   node scripts/ui/h5-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out plans/ui/h5] [--lang he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const OUT = path.resolve(arg('--out', 'plans/ui/h5'));
const LANG = arg('--lang', 'he');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (page, id) => { const b = page.getByTestId(id); if (await b.count()) { await b.first().dispatchEvent('click'); return true; } return false; };

for (const H of [390, 340]) {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.setItem('terra-imperium.language', l); localStorage.setItem('ti.coach.firstBattle', '1'); }, LANG);
  await page.goto(`${URL_BASE}?battleSandbox&autostart&age=bronze`);
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await wait(4000);
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${LANG}-${H}.png`), timeout: 120000 });
  await click(page, 'battle-start'); await wait(3000);
  await click(page, 'battle-hq'); await wait(900);
  await shot('camp');
  await click(page, 'battle-building-close'); await wait(300);
  await click(page, 'battle-select-all'); await wait(600);
  await click(page, 'battle-wand'); await wait(600);
  await shot('wand');
  await click(page, 'battle-wand-close'); await wait(300);
  await click(page, 'battle-idle-workers'); await wait(500);
  await click(page, 'battle-build'); await wait(800);
  await shot('build');
  await click(page, 'battle-build-close'); await wait(300);
  await click(page, 'battle-pause'); await wait(800);
  await shot('pause');
  await click(page, 'battle-leave'); await wait(600);
  await shot('retreat');
  await click(page, 'battle-retreat-all'); await wait(800);
  await click(page, 'battle-resume'); await wait(500);
  await page.evaluate(() => { const b = document.querySelector('[data-testid="battle-speed"]'); for (let i = 0; i < 2; i += 1) b?.click(); });
  for (let i = 0; i < 60; i += 1) { await wait(2000); if (await page.getByTestId('battle-result').count()) break; }
  await wait(1500);
  await shot('result');
  console.log(LANG, H, errors.length ? errors.slice(0, 2).join(' | ') : 'no page errors');
  await browser.close();
}
