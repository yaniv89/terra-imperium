// scripts/ui/pacing8-shots.mjs
// Shots of the lane pacing-8 city fixes (plans/lanes/pacing-8-REPORT.md) on the classical era save, at
// 844x390 (touch) and 1600x900, en and he: the queue list opened from a scrolled build list, a paid-in-full
// queued order, an outpost's row in the city list and its city card button.
//   npx vite --port 5287 &  node scripts/ui/pacing8-shots.mjs --tag after [--url http://localhost:5287/terra-imperium/]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg('--tag', 'after');
const URL = arg('--url', 'http://localhost:5287/terra-imperium/');
const OUT = path.resolve('plans/lanes/pacing-8-shots', TAG);
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The biggest city builds a long queue whose third order is already paid in full; one city is an outpost.
const base = readEraSave('classical').state;
const me = base.playerNationId;
const mine = Object.values(base.regions).filter((c) => c.owner === me && !c.outpost).sort((a, z) => (z.size || 0) - (a.size || 0));
const big = mine[0]; const small = mine[mine.length - 1];
const unit = (classId) => ({ kind: 'unit', classId });
const regions = {
  ...base.regions,
  [big.id]: { ...big, production: { ...big.production, current: unit('infantry'), queue: [unit('ranged'), { kind: 'building', category: 'food', tier: (big.buildings?.categories?.food ?? -1) + 1 }], progress: 0, stored: { 'building:food:0': 999, [`building:food:${(big.buildings?.categories?.food ?? -1) + 1}`]: 999 } } },
  [small.id]: { ...small, outpost: { progress: 30, startTurn: base.turnNumber - 4 } }
};
const save = { state: { ...base, regions } };

const run = async (browser, sizeId, lang) => {
  const size = SIZES[sizeId];
  const g = await openGame(browser, { size, lang, url: URL });
  const { page, cdp } = g;
  const tapAt = async (x, y) => (size.mobile
    ? (await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }), await wait(60), await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }))
    : page.mouse.click(x, y));
  const tap = async (loc) => { const l = loc.first(); if (!(await l.count())) return false; const b = await l.boundingBox({ timeout: 5000 }).catch(() => null); if (!b) return false; await tapAt(b.x + b.width / 2, b.y + b.height / 2); await wait(900); return true; };
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${sizeId}-${lang}.png`), timeout: 120000 });
  const ev = (name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
  await loadSlice(g, save);
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close|סגירה/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
  await dismiss();
  // 1. Build tab, scrolled to the bottom of the build list, then the queue toggle.
  await ev('ti:manage-city', { regionId: big.id, tab: 'build' }); await wait(2000);
  await page.evaluate(() => { const bar = document.querySelector('[data-testid="city-queue-bar"]'); let el = bar?.parentElement; while (el && el.scrollHeight <= el.clientHeight + 4) el = el.parentElement; if (el) el.scrollTop = el.scrollHeight; });
  await wait(600); await shot('1a-build-scrolled');
  if (await tap(page.getByTestId('city-queue-toggle'))) { await wait(800); await shot('1b-queue-open'); }
  // seen: the first row of the list is what a tap at its centre hits (not under the pinned bar, not off screen)
  const seen = await page.getByTestId('city-queue').evaluate((el) => { const li = el.querySelector('li'); const r = li.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && el.contains(hit); }).catch(() => false);
  console.log(`${sizeId} ${lang}: queue list in view after the toggle: ${seen}`);
  const paid = await page.getByTestId('city-queue').innerText().catch(() => '');
  console.log(`${sizeId} ${lang}: queue text: ${paid.replace(/\s+/g, ' ').slice(0, 300)}`);
  await page.keyboard.press('Escape'); await wait(500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels'))); await wait(600);
  // 2. The outpost: the cities list row, then its card.
  await ev('ti:open-tab', 'cities'); await wait(1500); await shot('2a-city-list');
  const row = await page.locator('body').innerText();
  console.log(`${sizeId} ${lang}: outpost row: ${(row.match(/(Growing into a city[^\n]*|גדל והופך לעיר[^\n]*)/) || ['none'])[0]}`);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels'))); await wait(600);
  await ev('ti:select-region', small.id); await wait(1500);
  const open = page.getByTestId('open-city-sheet');
  console.log(`${sizeId} ${lang}: outpost card button: ${await open.innerText().catch(() => 'not found')}`);
  await shot('2b-outpost-card');
  await g.ctx?.close?.();
};

const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const sizeId of Object.keys(SIZES)) for (const lang of ['en', 'he']) await run(browser, sizeId, lang).catch((e) => console.log(`${sizeId} ${lang}: ERROR ${e.message.split('\n')[0]}`));
await browser.close();
