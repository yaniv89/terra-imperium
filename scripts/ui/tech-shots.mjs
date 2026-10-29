// Research tab shots (lane tech-tree-8): 844x390 and 1600x900, en and he. Needs a dev server of THIS
// checkout: `npx vite --port 5263`, then `node scripts/ui/tech-shots.mjs [--url ...] [--out dir]`.
// Checks: End Turn never covers an age tab, the panel's age strip sits flush at its bottom, an age tab
// lists that age's techs, a row opens the detail sheet.
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { foundFirstCity } from '../../e2e/startHelpers.js';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const URL_BASE = arg('--url', 'http://localhost:5263/terra-imperium/');
const OUT = path.resolve(arg('--out', 'plans/ui/tech-tree-8'));
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const rect = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, W, H, lang) => {
  const tag = `${W}x${H}-${lang}`;
  const phone = W < 1000;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE, { timeout: 180000 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('terra-imperium.language', 'en'); });
  await page.goto(URL_BASE, { timeout: 180000 });
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2000);
  // A village so science flows (turn counts, not 'no science'), then switch language and open Research.
  // The choice card's "All techs" lands on the list (playtest 40746170250: it read as a loop). One run is enough.
  if (W < 1000 && lang === 'en') {
    const all = page.getByTestId('research-choice-all');
    await all.waitFor({ timeout: 30000 }).catch(() => {});
    if (await all.isVisible().catch(() => false)) {
      await click(all);
      await wait(1200);
      const top = await page.getByTestId('research-age-list').evaluate((el) => el.getBoundingClientRect().top).catch(() => -1);
      check(`${tag} the choice card's All techs shows the list`, top > 0 && top < H, `list top ${Math.round(top)}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-from-choice.png`) });
      await page.evaluate(async () => (await import('/terra-imperium/src/components/ui/uiEvents.js')).openResearchChoice?.());
    }
  }
  await foundFirstCity(page);
  await wait(1000);
  if (lang !== 'en') await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), lang);
  await page.evaluate(async () => (await import('/terra-imperium/src/components/panels/panelEvents.js')).openPanelTab('tech'));
  const tab = page.getByTestId('research-tab');
  await tab.waitFor({ timeout: 20000 });
  await wait(800);
  await page.screenshot({ path: path.join(OUT, `${tag}-top.png`) });

  const strip = page.getByTestId('research-age-strip');
  const end = page.getByTestId('end-turn');
  const s = await rect(strip);
  if (await end.isVisible().catch(() => false)) {
    const e = await rect(end);
    // Only the part of a tab inside the scrolling strip shows.
    const cells = (await strip.locator('button').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })))
      .map((c) => ({ ...c, left: Math.max(c.left, s.left), right: Math.min(c.right, s.right) })).filter((c) => c.right > c.left);
    check(`${tag} End Turn covers no age tab`, !cells.some((c) => overlap(c, e)), `end ${Math.round(e.left)}-${Math.round(e.right)}x${Math.round(e.top)}-${Math.round(e.bottom)}, strip ${Math.round(s.left)}-${Math.round(s.right)}`);
  }
  // The panel reaches the screen's foot: the age tabs share End Turn's band, no dead strip under them (F147).
  const gap = await strip.evaluate((el, h) => Math.round(h - el.parentElement.getBoundingClientRect().bottom), H);
  check(`${tag} age tabs flush at the screen's foot`, gap >= 0 && gap <= 2, `gap ${gap}px, tabs bottom ${Math.round(s.bottom)} of ${H}`);

  // An age tab lists its techs; a row opens the detail sheet.
  const bronze = page.getByTestId('jump-bronze');
  if (await bronze.count()) {
    await click(bronze);
    await wait(700);
    const rows = await page.locator('[data-testid^="tech-row-"]').count();
    check(`${tag} Bronze tab lists techs`, rows > 0, `${rows} rows`);
    await page.screenshot({ path: path.join(OUT, `${tag}-bronze.png`) });
    const first = page.locator('[data-testid^="tech-row-"]').first();
    if (rows) {
      await click(first);
      await wait(500);
      check(`${tag} a row opens the detail sheet`, await page.getByTestId('tech-detail').isVisible().catch(() => false));
      await page.screenshot({ path: path.join(OUT, `${tag}-detail.png`) });
    }
  }
  check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
};

const main = async () => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  for (const [W, H] of [[844, 390], [1600, 900]]) for (const lang of ['en', 'he']) await run(browser, W, H, lang);
  await browser.close();
  console.log(failed ? `${failed} failed` : 'all ok');
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
