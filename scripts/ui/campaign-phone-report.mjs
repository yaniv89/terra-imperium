// scripts/ui/campaign-phone-report.mjs
// The turn report on a phone held sideways: ends a few turns and shots the report.
//   node scripts/ui/campaign-phone-report.mjs --tag before|after [--lang he] [--h 340] [--url ...]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5411/terra-imperium/');
const TAG = arg('--tag', 'after'); const LANG = arg('--lang', 'en'); const H = Number(arg('--h', '390'));
const W = Number(arg('--w', '844'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(`audits/campaign-phone/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (l) => l.dispatchEvent('click');
const browser = await launchBrowser({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 1000, hasTouch: W < 1000, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL_BASE);
await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, LANG);
await page.goto(URL_BASE);
await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
await click(page.locator('[data-people]').first());
await page.getByTestId('start-step-ready').dispatchEvent('click');
await click(page.getByTestId('begin-game'));
const skip = page.getByRole('button', { name: /Skip|דילוג/ });
await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await click(skip);
await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
await wait(2500);
const adv = page.getByTestId('research-let-advisor');
if (await adv.isVisible().catch(() => false)) await click(adv);
let n = 0;
for (let i = 0; i < 20 && n < 1; i += 1) {
  await click(page.getByTestId('end-turn'));
  await wait(2500);
  if (await page.getByTestId('turn-report').count()) { n += 1; }
  else if (await page.getByTestId('turn-report-chip').count()) { await click(page.getByTestId('turn-report-chip')); await wait(500); n += (await page.getByTestId('turn-report').count()) ? 1 : 0; }
  else { const ev = page.getByTestId('event-option-0'); if (await ev.isVisible().catch(() => false)) { await click(ev); await wait(1200); } const a = page.getByTestId('research-let-advisor'); if (await a.isVisible().catch(() => false)) await click(a); }
}
await wait(600);
await page.screenshot({ path: path.join(OUT, `report-${LANG}-${W}x${H}.png`) });
const r = await page.getByTestId('turn-report').getByRole('dialog').evaluate((el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; }).catch(() => 'none');
console.log(`report open: ${n > 0}, panel ${r}`);
await browser.close();
