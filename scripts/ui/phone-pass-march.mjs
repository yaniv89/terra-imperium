// scripts/ui/phone-pass-march.mjs
// The phone pass: choosing a march, then opening a rail tab. The march bar used to draw over the
// tab's header; now it waits as a chip. One shot per size and language into --out.
//   node scripts/ui/phone-pass-march.mjs [--url http://localhost:5197/terra-imperium/] [--out dir] [--swgl]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/phone-pass'));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

for (const [h, lang] of [[390, 'en'], [340, 'he']]) {
  const id = `844x${h}-${lang}`;
  if (ONLY.length && !ONLY.includes(id)) continue;
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.locator('input').first().fill('Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-ready'));
  await click(page.getByTestId('begin-game'));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(2500);
  const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
  if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
  const advisor = page.getByTestId('research-let-advisor');
  if (await advisor.isVisible().catch(() => false)) await click(advisor);
  const idle = page.getByTestId('idle-chip'); const found = page.getByTestId('found-city');
  for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle).catch(() => {}); await wait(600); }
  if (await found.isVisible().catch(() => false)) { await click(found); await wait(1500); }
  for (let i = 0; i < 3; i++) { const c = page.locator('button[aria-label="Close"]:visible').first(); if (await c.count()) await click(c); await wait(200); }
  const tile = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.units).find((u) => u.ownerId === s.playerNationId && u.tile != null)?.tile; });
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:select-army', { detail: t })), tile);
  await wait(900);
  await click(page.getByTestId('army-march'));
  await wait(900);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: 'ruler' })));
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, `${id}-march-then-tab.png`) });
  const bar = await page.getByTestId('march-bar').count();
  const chip = await page.getByTestId('march-chip').count();
  console.log(`${id}: march bar on screen ${bar ? 'yes' : 'no'}, march chip ${chip ? 'yes' : 'no'}`);
  if (chip) {
    await click(page.getByTestId('march-chip'));
    await wait(1000);
    await page.screenshot({ path: path.join(OUT, `${id}-march-chip-back.png`) });
    console.log(`${id}: after the chip, march bar ${await page.getByTestId('march-bar').count() ? 'back' : 'missing'}`);
  }
  await browser.close();
}
