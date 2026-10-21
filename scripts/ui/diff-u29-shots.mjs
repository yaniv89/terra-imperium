// scripts/ui/diff-u29-shots.mjs
// Real-browser check of the Chronicle reader and share image (differentiation plan U29) at 844x390 and 1280x800,
// English and Hebrew; screenshots into audits/diff-u29/. Needs a dev server of THIS checkout.
//   node scripts/ui/diff-u29-shots.mjs [--url http://localhost:5329/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5329/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/diff-u29');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^(Begin as|התחל)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.evaluate(async () => {
    const s = window.__game.state; const me = s.playerNationId;
    const { tileRuns } = await import('/terra-imperium/src/engine/chronicle.js');
    const mine = Object.values(s.regions).filter((c) => c.owner !== me).slice(0, 6);
    const regions = { ...s.regions };
    mine.forEach((c) => { regions[c.id] = { ...c, owner: me, ownerId: me }; });
    const s0 = { ...s, regions };
    const runs = tileRuns(s0);
    const cities = Object.values(s.regions).filter((c) => c.ownerId === me || c.owner === me).slice(0, 2).map((c) => ({ t: 3, id: c.id, how: 'founded' }));
    const b = (i, f, o) => ({ t: 5 + i, id: 'battle-' + i, name: 'Battle of Ur ' + i, tile: 1, kind: 'land', side: 'attacker', outcome: o, fallen: f });
    const chronicle = { battleSeq: 0, chapters: [
      { age: 'stone', from: 1, to: 20, label: -2000, tiles: runs.slice(0, Math.max(2, runs.length - 2)), wars: [], cities, ambitions: [], battles: [b(1, 120, 'attacker'), b(2, 80, 'defender'), b(3, 40, 'stalemate')] },
      { age: 'bronze', from: 20, label: -1500, wars: [], cities: [], ambitions: [], battles: [] }] };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s0, chronicle } });
  });
  await wait(500);
  if (lang === 'he') {
    await click(page.getByTestId('landscape-rail').getByRole('button', { name: 'Menu' }));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await click(page.getByTestId('settings-language').getByTestId('lang-he'));
    await wait(600);
    await page.keyboard.press('Escape');
    await wait(400);
  }
  const rail = page.getByTestId('landscape-rail');
  await click(rail.getByRole('button', { name: /^(Legacy|מורשת)$/ }));
  await page.getByTestId('legacy-score').waitFor({ timeout: 10000 }).catch(async (e) => { await page.screenshot({ path: path.join(OUT, 'debug.png') }); console.log(errors, e.message); throw e; });
  await wait(400);
  await click(page.getByTestId('chronicle').getByRole('button').first());
  await page.getByTestId('chronicle-chapter').first().waitFor({ timeout: 10000 }).catch(async (e) => { await page.screenshot({ path: path.join(OUT, 'debug.png') }); console.log(errors); throw e; });
  await page.getByTestId('chronicle').scrollIntoViewIfNeeded();
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-1-panel.png`) });
  const dl = page.waitForEvent('download', { timeout: 10000 });
  await click(page.getByTestId('chronicle').getByRole('button').last());
  await (await dl).saveAs(path.join(OUT, `${tag}-image.png`));
  await page.evaluate(() => { const s = window.__game.state; window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, gameStatus: 'COMPLETE', finalRank: 2, ending: { reason: 'turnLimit' } } }); });
  await page.getByTestId('chronicle').last().waitFor({ timeout: 10000 });
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-2-gameover.png`) });
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(`${tag}: no horizontal scroll`, !hs);
  check(`${tag}: no page errors`, errors.length === 0, errors[0] || '');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone-en', { width: 844, height: 390 }, 'en');
await run(browser, 'phone-he', { width: 844, height: 390 }, 'he');
await run(browser, 'desktop-en', { width: 1280, height: 800 }, 'en');
await browser.close();
process.exit(failed ? 1 : 0);
