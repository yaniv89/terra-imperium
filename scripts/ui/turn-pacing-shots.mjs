// scripts/ui/turn-pacing-shots.mjs
// Lane turn-pacing shots: the short start tutorial, End Turn's "Advisor builds" beside "Choose
// production" (three idle cities), the dock after one tap, and the Goal chip, at 844x390 and
// 1600x900 in English and Hebrew, into plans/ui/turn-pacing/. Needs `npx vite --port 5197`.
//   node scripts/ui/turn-pacing-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/turn-pacing');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const SIZES = [{ id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false }];

let failed = 0;
for (const size of SIZES) for (const lang of ['en', 'he']) {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${size.id}-${lang}.png`), timeout: 120000 });
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  if (lang === 'he') await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'));
  await wait(2500);
  await shot('onboarding-1');
  const next = page.getByRole('button', { name: lang === 'he' ? /הבא/ : /^Next/ });
  if (await next.count()) { await click(next.first()); await wait(400); await shot('onboarding-2'); }
  const skip = page.getByRole('button', { name: lang === 'he' ? 'דילוג' : 'Skip' });
  if (await skip.count()) await click(skip.first());
  await wait(800);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|אחר כך|היועץ/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
  // Three idle cities beside the start (a band start has no capital), nothing queued anywhere.
  await page.evaluate(async () => {
    const tw = await import('/terra-imperium/src/engine/testWorld.js');
    const s0 = window.__game.state;
    const me = s0.playerNationId;
    const near = s0.nations[me].capitalRegionId ? null : Object.values(s0.units).find((u) => u.ownerId === me && u.tile != null)?.tile;
    const { state: s } = tw.addCities(s0, me, 3, { near });
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { current: null, queue: [], progress: 0 } } : c]));
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, research: { ...s.research, auto: true } } });
  });
  await wait(2000);
  const adv = page.getByTestId('advisor-build');
  const has = await adv.count();
  await shot('advisor-build');
  if (!has) { failed += 1; console.log(size.id, lang, 'FAIL: no Advisor builds button'); }
  else {
    await click(adv);
    await wait(1200);
    const mode = await page.getByTestId('end-turn').getAttribute('data-mode');
    const idle = await page.evaluate(() => Object.values(window.__game.state.regions).filter((c) => c.owner === window.__game.state.playerNationId && !c.production?.current).length);
    await shot('after-advisor');
    console.log(size.id, lang, `after one tap: end turn ${mode}, idle cities ${idle}`);
    if (idle) failed += 1;
  }
  console.log(size.id, lang, errors.length ? `page errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  if (errors.length) failed += 1;
  await browser.close();
}
process.exit(failed ? 1 : 0);
