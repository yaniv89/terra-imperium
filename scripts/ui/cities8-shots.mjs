// scripts/ui/cities8-shots.mjs
// Screens of lane cities-8: the city Build tab with nothing in production (the advisor's reason, its
// row marked) and with a queue (how many build rows a phone shows under the pinned bar), the Overview
// (what the city is known for, the next citizen) and the Defense tab's wall order. 844x390 and
// 1600x900, en and he, into plans/ui/cities-8/<tag>/. Needs `npx vite --port 5197`.
//   node scripts/ui/cities8-shots.mjs [--tag after] [--swgl] [--only phone-en]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/ui/cities-8', arg('--tag', 'after'));
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const fire = (page, name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);

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
  // A peoples start is a band with no city yet: found the capital where it stands.
  await page.evaluate(() => { const g = window.__game; const u = Object.values(g.state.units).find((x) => x.ownerId === g.state.playerNationId && x.classId === 'settler'); if (u) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: u.id } }); });
  await wait(1500);
  if (lang === 'he') await page.evaluate(async () => { (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'); });
  await wait(800);
};

// Run `body` with `s` (the live state) and `m` (the engine modules named), load what it returns.
const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const next = await new Function('s', 'm', `return (async () => { ${body} })();`)(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

const closeAll = async (page) => { await page.keyboard.press('Escape'); await fire(page, 'ti:close-panels'); await wait(400); };

const ONLY = arg('--only', null);
const openCity = (page, tab) => page.evaluate((tb) => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: window.__game.state.nations[window.__game.state.playerNationId].capitalRegionId, tab: tb } })), tab);
// Build rows whose top edge is on screen: what a phone shows without scrolling.
const rowsOnScreen = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="build-row"]')].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.top < window.innerHeight - 20 && b.height > 0; }).length);

const run = async () => {
  const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'he']) {
      if (ONLY && ONLY !== `${vp.id}-${lang}`) continue;
      const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = async (name) => { await wait(700); await page.screenshot({ path: path.join(OUT, `${name}-${vp.id}-${lang}.png`) }); console.log('shot', name, vp.id, lang); };
      try {
        await startGame(page, lang);
        // Nothing in production, the wall's tech known, a bigger capital with a granary.
        await patch(page, `
          const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
          const techTree = { ...s.techTree, governance_chiefdoms: { ...s.techTree.governance_chiefdoms, researched: true } };
          return { ...s, techTree, regions: { ...s.regions, [capId]: { ...cap, size: 3, production: { current: null, queue: [], progress: 0 } } } };`);
        await openCity(page, 'build');
        await shot('build-idle');
        console.log('rows', vp.id, lang, 'idle', await rowsOnScreen(page));
        await closeAll(page);
        await patch(page, `
          const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
          const prod = { current: { kind: 'settler' }, queue: [{ kind: 'unit', classId: 'infantry' }], progress: 10 };
          return { ...s, regions: { ...s.regions, [capId]: { ...cap, production: prod } } };`);
        await openCity(page, 'build');
        await shot('build-busy');
        console.log('rows', vp.id, lang, 'busy', await rowsOnScreen(page));
        // Scrolled down the list: the build rows between the pinned queue bar and the screen's bottom.
        console.log('rows', vp.id, lang, 'busy-scrolled', await page.evaluate(() => {
          const panel = document.querySelector('[data-testid="city-sheet-panel"]');
          const box = [panel, ...panel.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY === 'auto');
          box.scrollTop = 260;
          const barBottom = document.querySelector('[data-testid="city-queue-bar"]').getBoundingClientRect().bottom;
          const bottom = Math.min(window.innerHeight, panel.getBoundingClientRect().bottom);
          return [...document.querySelectorAll('[data-testid="build-row"]')].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= barBottom - 2 && b.bottom <= bottom + 2; }).length;
        }));
        await shot('build-scrolled');
        await closeAll(page);
        await openCity(page, 'overview');
        await shot('overview');
        await closeAll(page);
        await openCity(page, 'defense');
        await wait(500);
        await shot('defense');
        const wall = page.getByTestId('city-defense-paths').locator('button').first();
        if (await wall.count()) { await click(wall); await wait(600); await shot('defense-wall-queued'); }
        console.log('current', vp.id, lang, await page.evaluate(() => JSON.stringify(window.__game.state.regions[window.__game.state.nations[window.__game.state.playerNationId].capitalRegionId].production.current)));
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
