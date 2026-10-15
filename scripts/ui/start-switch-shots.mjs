// The compact language switch must show on every start step, in both languages, on short phones.
//   node scripts/ui/start-switch-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out plans/ui/h2]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const OUT = path.resolve(arg('--out', 'plans/ui/h2'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
for (const [W, H] of [[844, 390], [844, 340], [667, 375]]) for (const lang of ['en', 'he']) {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  for (const step of ['people', 'world', 'rules', 'ready']) {
    await page.getByTestId(`start-step-${step}`).dispatchEvent('click');
    await wait(500);
    const box = await page.getByTestId('language-switch').boundingBox();
    const ok = !!box && box.x >= 0 && box.x + box.width <= W && box.y >= 0 && box.y + box.height <= H;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${W}x${H} ${lang} ${step} ${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'missing'}`);
    await page.screenshot({ path: path.join(OUT, `switch-${lang}-${W}x${H}-${step}.png`) });
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
