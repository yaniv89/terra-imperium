// scripts/ui/stone-people-shots.mjs
// People shown by age (ages.js shownPeople) and the village size cap (stonePhase.js): a Stone
// capital of size 7 shows about 2,300 people on the city card, the empire overview and the grow
// preview, and a farming village at size 4 says why it grows no more. 844x390 and 1600x900, en and
// he, into plans/ui/stone-people/. Needs a dev server of THIS checkout and Chrome.
//   node scripts/ui/stone-people-shots.mjs [--url http://localhost:5271/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { foundFirstCity } from '../../e2e/startHelpers.js';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5271/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/stone-people');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

// The capital at `size`, research set so the nation is a farming village (Agriculture, no Chiefdoms).
const SET = async (size) => {
  const s = window.__game.state; const me = s.playerNationId;
  const capId = s.nations[me].capitalRegionId || Object.values(s.regions).find((c) => c.owner === me)?.id;
  const techTree = Object.fromEntries(Object.entries(s.techTree || {}).map(([id, t]) => [id, id === 'governance_chiefdoms' ? { ...t, researched: false } : id === 'economy_agriculture' ? { ...t, researched: true } : t]));
  const city = s.regions[capId];
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, techTree, regions: { ...s.regions, [capId]: { ...city, size, food: 0, currentPopulation: null } } } });
  return capId;
};

const run = async (browser, name, viewport, mobile, he) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(240000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await foundFirstCity(page);
  await page.keyboard.press('Escape');
  if (he) await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'));
  const shot = (what) => page.screenshot({ path: path.join(OUT, `${name}-${what}.jpg`), type: 'jpeg', quality: 80, timeout: 120000 });

  // 1. City card: size 7 in the Stone Age shows a village's people.
  const capId = await page.evaluate(SET, 7);
  await wait(800);
  await page.evaluate(async (id) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectRegion(id), capId);
  await wait(1500);
  const body = await page.locator('body').innerText();
  check(`${name}: city card shows about 2,300 people`, /2[,.]?3\d\d|2\.3/.test(body), (body.match(/[\d,.]+K?/g) || []).slice(0, 12).join(' '));
  check(`${name}: no 232,000 anywhere`, !/232[,.]?\d{3}|232K/i.test(body));
  await shot('city-card');
  await page.keyboard.press('Escape');
  await wait(500);

  // 2. Empire overview (Empire tab).
  await page.evaluate(async () => (await import('/terra-imperium/src/components/panels/panelEvents.js')).openPanelTab('domestic'));
  await wait(1500);
  await shot('empire');
  await page.keyboard.press('Escape');
  await wait(500);

  // 3. City panel at size 4, a farming village: the growth line says why it stops.
  await page.evaluate(SET, 4);
  await wait(600);
  await page.evaluate(async (id) => (await import('/terra-imperium/src/components/map/marchEvents.js')).manageCity(id, 'overview'), capId);
  await wait(1800);
  const line = page.getByText(he ? /בגודל המרבי של כפר/ : /as large as a village grows/).first();
  check(`${name}: village cap line shows`, await line.isVisible().catch(() => false));
  await shot('city-village');

  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', { width: 844, height: 390 }, true, false);
await run(browser, 'phone-he', { width: 844, height: 390 }, true, true);
await run(browser, 'desktop', { width: 1600, height: 900 }, false, false);
await run(browser, 'desktop-he', { width: 1600, height: 900 }, false, true);
await browser.close();
process.exit(failed ? 1 : 0);
