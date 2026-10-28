// scripts/ui/tech-help-shots.mjs
// Screens of lane tech-help-8: the Research tab (lines and the web with a tapped tech), the glossary
// index with its hold hint, a tech entry (gives, unlocks, boost, leads to), a tech-locked unit's
// entry, a building, a resource and an improvement entry, and the city Build tab. 844x390 and 1600x900, en and he, into plans/ui/tech-help/<tag>/. Needs `npx vite --port 5197`.
//   node scripts/ui/tech-help-shots.mjs [--tag after] [--url http://localhost:5197/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/ui/tech-help', arg('--tag', 'after'));
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const fire = (page, name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
const glossary = (page, kind, id) => page.evaluate(async ([k, i]) => (await import('/terra-imperium/src/components/ui/uiEvents.js')).openGlossary(k, i), [kind, id]);

const startGame = async (page, lang) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', 'Kemet');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2000);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
  await page.evaluate(() => { const g = window.__game; const u = Object.values(g.state.units).find((x) => x.ownerId === g.state.playerNationId && x.classId === 'settler'); if (u) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: u.id } }); });
  await wait(1500);
  if (lang === 'he') await page.evaluate(async () => { (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'); });
  await wait(800);
};
const closeAll = async (page) => { await page.keyboard.press('Escape'); await fire(page, 'ti:close-panels'); await wait(400); };

const run = async () => {
  const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'he']) {
      const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = async (name) => { await wait(700); await page.screenshot({ path: path.join(OUT, `${name}-${vp.id}-${lang}.png`) }); console.log('shot', name, vp.id, lang); };
      try {
        await startGame(page, lang);
        await fire(page, 'ti:open-tab', 'tech');
        await wait(800);
        await shot('research');
        await click(page.getByTestId('research-web-toggle'));
        await wait(500);
        await page.getByTestId('research-web').scrollIntoViewIfNeeded();
        await click(page.getByTestId('web-military_copper_working'));
        await wait(400);
        const picked = page.getByTestId('research-web-picked');
        if (await picked.count()) await picked.scrollIntoViewIfNeeded();
        await shot('research-web-tap');
        await closeAll(page);
        await fire(page, 'ti:open-menu', 'all');
        await click(page.getByTestId('menu-glossary'));
        await shot('glossary-index');
        await closeAll(page);
        await glossary(page, 'tech', 'military_bronze_casting');
        await shot('glossary-tech');
        await closeAll(page);
        await glossary(page, 'unit', 'bronze_cavalry');
        await shot('glossary-unit');
        await closeAll(page);
        await glossary(page, 'term', 'boosts');
        await shot('glossary-term');
        await closeAll(page);
        for (const [kind, id] of [['building', 'food.1'], ['resource', 'copper'], ['improvement', 'mine']]) {
          await glossary(page, kind, id);
          await shot(`glossary-${kind}`);
          await closeAll(page);
        }
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: window.__game.state.nations[window.__game.state.playerNationId].capitalRegionId, tab: 'build' } })));
        await shot('build');
        await page.evaluate(() => document.querySelector('[data-help^="building:"]')?.scrollIntoView({ block: 'center' }));
        await shot('build-buildings');
        await closeAll(page);
      } catch (e) {
        console.log('FAIL', vp.id, lang, e.message.split('\n')[0]);
        await page.screenshot({ path: path.join(OUT, `fail-${vp.id}-${lang}.png`) }).catch(() => {});
      }
      if (errors.length) console.log('page errors', vp.id, lang, errors.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
};
run();
