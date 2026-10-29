// scripts/ui/earlypace8-shots.mjs
// Shots of lane early-pace-8 (plans/lanes/early-pace-8-REPORT.md) on the classical era save, at 844x390 (touch)
// and 1600x900, en and he: the buy offer of a later queued order (price, gold after), the queue after paying
// (the bought order at the front, locked with its reason) and the era goal chip (goal, progress, reward).
//   npx vite --port 5293 &  node scripts/ui/earlypace8-shots.mjs [--url http://localhost:5293/terra-imperium/]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5293/terra-imperium/');
const OUT = path.resolve('plans/lanes/early-pace-8-shots');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The biggest city builds infantry, then ranged, then its next food tier; the treasury is small enough that
// buying the second order asks again (above BUY_CONFIRM_SHARE).
const base = readEraSave('classical').state;
const me = base.playerNationId;
const big = Object.values(base.regions).filter((c) => c.owner === me && !c.outpost).sort((a, z) => (z.size || 0) - (a.size || 0))[0];
const unit = (classId) => ({ kind: 'unit', classId });
const regions = { ...base.regions, [big.id]: { ...big, rush: null, production: { ...big.production, current: unit('infantry'), queue: [unit('ranged'), { kind: 'building', category: 'food', tier: (big.buildings?.categories?.food ?? -1) + 1 }], progress: 0, stored: {} } } };
const save = { state: { ...base, regions, resources: { ...base.resources, gold: 1500 } } };

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
  // 0. The era goal chip on the map.
  console.log(`${sizeId} ${lang}: goal chip: ${await page.getByTestId('goal-tracker-chip').innerText().catch(() => 'not found')}`);
  await shot('0-goal-chip');
  // 1. Build tab, queue open, Buy on the second order: the offer.
  await ev('ti:manage-city', { regionId: big.id, tab: 'build' }); await wait(2000);
  await tap(page.getByTestId('city-queue-toggle')); await wait(800);
  await tap(page.getByTestId('queue-rush').nth(1));
  console.log(`${sizeId} ${lang}: offer: ${(await page.getByTestId('city-rush-offer').innerText().catch(() => 'none')).replace(/\s+/g, ' ')}`);
  await shot('1-buy-offer');
  // 2. Pay: the bought order leads the queue, locked.
  await tap(page.getByTestId('city-rush-pay'));
  if (!(await page.getByTestId('city-queue').isVisible().catch(() => false))) await tap(page.getByTestId('city-queue-toggle'));
  await wait(600);
  console.log(`${sizeId} ${lang}: queue after: ${(await page.getByTestId('city-queue').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
  console.log(`${sizeId} ${lang}: lock shown: ${await page.getByTestId('queue-locked').count()}`);
  await shot('2-paid-locked');
  await g.ctx?.close?.();
};

const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const sizeId of Object.keys(SIZES)) for (const lang of ['en', 'he']) await run(browser, sizeId, lang).catch((e) => console.log(`${sizeId} ${lang}: ERROR ${e.message.split('\n')[0]}`));
await browser.close();
