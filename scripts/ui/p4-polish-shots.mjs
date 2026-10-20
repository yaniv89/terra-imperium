// scripts/ui/p4-polish-shots.mjs
// Playtest 4 #10: the war confirm card at the phone (844x390) and on desktop. Needs `npx vite --port 5311`.
//   node scripts/ui/p4-polish-shots.mjs [--url http://localhost:5311/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const i = process.argv.indexOf('--url');
const URL_BASE = i >= 0 ? process.argv[i + 1] : 'http://localhost:5311/terra-imperium/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve('audits/p4-polish');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async (browser, name, viewport, mobile) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await page.locator('[data-people]').first().dispatchEvent('click');
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.evaluate(async () => {
    const c = await import('/terra-imperium/src/components/ui/confirmSpecs.js');
    const d = await import('/terra-imperium/src/components/ui/ConfirmActionDialog.jsx');
    const s = window.__game.state;
    const other = Object.values(s.nations).find((n) => n.id !== s.playerNationId && !n.isEliminated && n.kind !== 'independent');
    d.askConfirm(c.declareWarConfirm(s, other.id), () => {});
  });
  await wait(800);
  const found = await page.getByTestId('confirm-action-dialog').isVisible();
  await page.screenshot({ path: path.join(OUT, `${name}-war-confirm.png`) });
  // A backdrop tap must not close a decision card.
  await page.mouse.click(3, 3);
  await wait(300);
  const stays = await page.getByTestId('confirm-action-dialog').isVisible();
  console.log(`${name}: card shown=${found} survives backdrop tap=${stays} errors=${errors.length}`);
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone-844x390', { width: 844, height: 390 }, true);
await run(browser, 'desktop-1280x800', { width: 1280, height: 800 }, false);
await browser.close();
