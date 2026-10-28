// scripts/ui/newcomer-shots.mjs
// Screens of lane newcomer-flow (round 2 newcomer-phone playtest): the next-step chip, the glossary
// from the menu, the Cities list with a queue, the Peoples tab, a Ruler virtue tap, the governor
// prompt, the city Build tab and a foreign army's tile. 844x390 and 1600x900, en and he, into
// plans/ui/newcomer/<tag>/. Needs `npx vite --port 5197`.
//   node scripts/ui/newcomer-shots.mjs [--tag after] [--url http://localhost:5197/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/ui/newcomer', arg('--tag', 'after'));
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
        await shot('map-fresh');
        if (vp.id === 'phone' && lang === 'en') {
          console.log('rail', JSON.stringify(await page.evaluate(() => { const nav = document.querySelector('[data-testid="landscape-rail"] nav'); return nav ? { scroll: nav.scrollHeight - nav.clientHeight, rows: [...nav.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(r.top), Math.round(r.height), Math.round(r.width)]; }) } : null; })));
        }
        const step = page.getByTestId('next-step');
        if (await step.count()) { console.log('step', await step.getAttribute('data-step')); await click(step); await wait(900); await shot('step-tap'); await closeAll(page); }
        // A queue behind the current build, a ruler point and an empty governor seat.
        await patch(page, `
          const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
          const prod = { ...cap.production, current: { kind: 'settler' }, queue: [{ kind: 'unit', classId: 'infantry' }, { kind: 'unit', classId: 'support', explorer: true }] };
          return { ...s, regions: { ...s.regions, [capId]: { ...cap, production: prod } } };`);
        await shot('map');
        await fire(page, 'ti:open-menu', 'all');
        await click(page.getByTestId('menu-glossary'));
        await wait(600);
        await shot('glossary');
        await closeAll(page);
        await fire(page, 'ti:open-tab', 'cities');
        await shot('cities');
        await fire(page, 'ti:open-tab', 'diplomacy');
        await shot('peoples');
        await fire(page, 'ti:open-tab', 'ruler');
        await wait(500);
        const cell = page.locator('[data-testid="ruler-tree"] button[data-state]').first();
        if (await cell.count()) await click(cell);
        await shot('ruler-virtue');
        await closeAll(page);
        // The "Free law change" chip's go (promptActions.js): the Empire tab, then its Laws section.
        await patch(page, `const me = s.playerNationId; return { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], freeLawChange: true } } };`);
        await wait(600);
        const law = page.locator('[data-testid="next-prompt"] button', { hasText: /law|חוק/i }).first();
        if (!(await law.count())) { const more = page.locator('[data-testid="next-prompt"] button', { hasText: /^\+/ }).first(); if (await more.count()) await click(more); await wait(300); }
        await click(page.locator('[data-testid="next-prompt"] button', { hasText: /law|חוק/i }).first());
        await wait(1500);
        await shot('law');
        await closeAll(page);
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: window.__game.state.nations[window.__game.state.playerNationId].capitalRegionId, tab: 'build' } })));
        await shot('build');
        await closeAll(page);
        // A foreign major's army next to the capital, at peace.
        await patch(page, `
          const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
          const tiles = m.getTiles(); const tile = tiles.neighbors[cap.tile].find((t) => tiles.land[t] === 1);
          const foe = s.nations[Object.values(s.regions).find((c) => c.owner && c.owner !== me && s.nations[c.owner] && s.nations[c.owner].kind !== 'independent').owner];
          window.__nc = { tile };
          const u = { id: 'nc_foreign', ownerId: foe.id, regionId: null, homeRegionId: null, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null };
          const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog;
          return { ...s, fog, units: { ...s.units, nc_foreign: u } };`, ['data/geo/tiles.js']);
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-tile', { detail: window.__nc.tile })));
        await shot('foreign-unit');
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
