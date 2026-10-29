// scripts/ui/naval9-shots.mjs
// Lane naval-9: where ships are built and what a ship does next, in a real browser at 844x390 and
// 1600x900: an inland city's Ships filter with the greyed row naming the port, the next-step chip
// "Sail your War Galley" opening the sail order, and a land march over water saying the army crosses
// on its own boats. Needs a dev server (`npx vite --port 5363`).
//   node scripts/ui/naval9-shots.mjs [--url http://localhost:5363/terra-imperium/] [--chrome <path>] [--he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5363/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/naval9');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const onScreen = async (page, loc) => { const b = await loc.boundingBox().catch(() => null); const v = page.viewportSize(); return !!b && b.y >= 0 && b.y + b.height <= v.height && b.x >= 0 && b.x + b.width <= v.width; };
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed += 1; };

const startGame = async (page, people) => {
  await page.goto(URL_BASE, { timeout: 300000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE, { timeout: 300000 });
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

const shot = async (page, name, vp) => {
  await wait(900);
  const file = path.join(OUT, `${name}-${vp.id}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 60, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file));
};
const closePanels = (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));

// Classical (self-embark is open), the capital is the port; the nearest inland city of anyone becomes
// the player's; the guide is over; a settler out, a scout on hold and an army so the next step is the ship.
const SETUP = `
  const me = s.playerNationId;
  s = m.withAgesResearched(s, me, 'classical');
  const tiles = m.getTiles();
  const port = Object.values(s.regions).find((c) => c.owner === me && m.hasSeaCoast(tiles, c));
  const d = (c) => Math.hypot(...[0, 1, 2].map((k) => tiles.centres[c.tile][k] - tiles.centres[port.tile][k]));
  const inland = Object.values(s.regions).filter((c) => c.tile != null && !c.outpost && !c.ghost && c.owner !== me && tiles.coastal[c.tile] !== 1).sort((a, b) => d(a) - d(b))[0];
  window.__naval = { port: port.id, tile: port.tile, inland: inland.id };
  const unit = (id, extra) => ({ id, ownerId: me, regionId: port.id, homeRegionId: port.id, tile: port.tile, domain: 'land', classId: 'infantry', ageId: 'classical', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });
  const units = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.ownerId !== me));
  Object.assign(units, { n9st: unit('n9st', { classId: 'settler' }), n9sc: unit('n9sc', { classId: 'support', explorer: true, hold: true, strength: 300, maxStrength: 300 }), n9inf: unit('n9inf'), n9sh: unit('n9sh', { domain: 'naval', classId: 'naval', navalLine: 'warship', transportCapacity: 1 }) });
  return { ...s, tutorial: null, units, fog: { ...s.fog, met: {} }, regions: { ...s.regions, [inland.id]: { ...inland, owner: me, size: Math.max(2, inland.size || 1) } } };
`;

const run = async (vp, lang) => {
  const browser = await launchBrowser({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, locale: lang });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startGame(page, 'Tartessos');
  await page.evaluate(() => { const s = window.__game.state; const u = Object.values(s.units).find((x) => x.ownerId === s.playerNationId && x.classId === 'settler'); if (u) window.__game.dispatch({ type: 'FOUND_CITY', payload: { unitId: u.id } }); });
  await wait(1500);
  if (lang !== 'en') { await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), lang); await wait(1500); }
  await patch(page, SETUP, ['engine/research.js', 'data/geo/tiles.js', 'engine/world/cities.js']);
  const nv = await page.evaluate(() => window.__naval);

  // 1. the inland city: Ships filter, one greyed row naming the port
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: id, tab: 'build' } })), nv.inland);
  await wait(1500);
  const chip = page.getByTestId('build-group-ships');
  check(await chip.isVisible().catch(() => false), `${vp.id} ${lang}: inland city has a Ships filter`);
  if (await chip.isVisible().catch(() => false)) await click(chip);
  await wait(600);
  const why = page.getByText(lang === 'en' ? /Not on the sea: build ships in/ : /העיר אינה על הים/).first();
  await why.scrollIntoViewIfNeeded().catch(() => {});
  check(await onScreen(page, why), `${vp.id} ${lang}: the ship row names where ships are built`);
  await shot(page, `1-inland-ships-${lang}`, vp);
  await closePanels(page);
  await wait(800);

  // 2. the next step: sail the ship that never left port; the tap opens the sail order
  const step = page.locator('[data-testid="next-step"][data-step="sail"]');
  await step.waitFor({ timeout: 8000 }).catch(() => {});
  check(await onScreen(page, step), `${vp.id} ${lang}: next step "Sail your ..." on screen`);
  await shot(page, `2-sail-step-${lang}`, vp);
  if (await step.isVisible().catch(() => false)) await click(step);
  await wait(1200);
  const origin = page.getByTestId('march-origin');
  check(await onScreen(page, origin), `${vp.id} ${lang}: the step opens the sail order`);
  await shot(page, `3-sail-order-${lang}`, vp);
  await page.keyboard.press('Escape');
  await page.locator('button[aria-label="Cancel"], button[aria-label="ביטול"]').first().dispatchEvent('click').catch(() => {});
  await wait(600);

  // 3. a land march over a strait: the army crosses on its own boats (classical self-embark)
  const target = await page.evaluate(async () => {
    const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const { planMarch } = await import('/terra-imperium/src/engine/routes.js');
    const s = window.__game.state; const tiles = getTiles(); const { tile, port } = window.__naval;
    const seen = new Map([[tile, 0]]); const q = [tile];
    while (q.length) {
      const at = q.shift();
      for (const n of tiles.neighbors[at]) {
        if (seen.has(n)) continue; seen.set(n, seen.get(at) + 1);
        if (seen.get(n) > 8) continue;
        if (tiles.land[n] !== 1) { q.push(n); continue; }
        if (seen.get(n) < 3 || s.world.tileOwner[n] != null) continue;
        const p = planMarch(s, port, n, ['n9inf'], {});
        if (p.ok && p.steps.some((t) => tiles.land[t] !== 1)) return n;
      }
    }
    return null;
  });
  check(target != null, `${vp.id} ${lang}: found a land tile reached over water`);
  if (target != null) {
    await page.evaluate(({ port, target }) => window.dispatchEvent(new CustomEvent('ti:start-march', { detail: { from: port, naval: false, unitIds: ['n9inf'], target } })), { port: nv.port, target });
    await wait(1500);
    const line = page.getByTestId('march-self-embark');
    check(await onScreen(page, line), `${vp.id} ${lang}: the march bar says it crosses on its own boats`);
    await shot(page, `4-self-embark-${lang}`, vp);
  }
  check(!errors.length, `${vp.id} ${lang}: no page errors ${errors.slice(0, 2).join(' | ')}`);
  await browser.close();
};

for (const vp of VIEWPORTS) for (const lang of process.argv.includes('--he') ? ['en', 'he'] : ['en']) await run(vp, lang);
process.exit(failed ? 1 : 0);
