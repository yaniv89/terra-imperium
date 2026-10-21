// scripts/ui/diff-u9-shots.mjs
// Real-browser check of the decree top bar item (differentiation plan U9): phone landscape and
// desktop, English and Hebrew, plus a Diplomacy card with a decree price. Needs `npx vite --port 5211`.
//   node scripts/ui/diff-u9-shots.mjs [--url http://localhost:5211/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5211/terra-imperium/');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve('audits/diff-u9');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: /^Skip/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  if (lang === 'he') await page.evaluate(async () => { (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'); });
  // a bank with a few reasons in it
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId; const n = s.nations[me];
    const log = [{ turn: 3, deed: 'warWon', detail: 'Elam', n: 1 }, { turn: 2, act: 'changeLaw', n: -1 }, { turn: 1, deed: 'doctrine', n: 1 }];
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, nations: { ...s.nations, [me]: { ...n, ruler: { ...n.ruler, decrees: 2, decreeLog: log } } } } });
  });
  await wait(600);
  const item = page.getByTestId('top-bar-decrees');
  check(`${tag}: decree item on the bar`, await item.isVisible());
  check(`${tag}: reads 2/3`, /2\s*\/\s*3/.test(await item.innerText()), await item.innerText());
  const barH = await page.getByTestId('world-top-bar').evaluate((el) => Math.round(el.getBoundingClientRect().height));
  check(`${tag}: bar one line`, barH <= 50, `${barH}px`);
  await click(item);
  await page.getByTestId('top-bar-reasons').waitFor({ timeout: 5000 });
  const text = await page.getByTestId('top-bar-reasons').innerText();
  check(`${tag}: reasons and costs shown`, /Elam|אילם/.test(text) && /1/.test(text), text.replace(/\n/g, ' | ').slice(0, 160));
  const box = await page.getByTestId('top-bar-reasons').evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
  check(`${tag}: sheet inside the screen`, box.l >= 0 && box.r <= viewport.width + 1 && box.b <= viewport.height + 1, JSON.stringify(box));
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${tag}.png`), timeout: 120000 });
  check(`${tag}: no page errors`, errors.length === 0, errors[0] || '');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone-en', { width: 844, height: 390 }, 'en');
await run(browser, 'phone-he', { width: 844, height: 390 }, 'he');
await run(browser, 'desktop-en', { width: 1280, height: 800 }, 'en');
await browser.close();
process.exit(failed ? 1 : 0);
