// scripts/ui/glide-report-shots.mjs
// Real-browser check of the army banner glide after End Turn: it waits for the turn report to be
// closed, then plays; with no report it plays at once; before it plays the banner stands on its OLD
// tile. Needs a dev server of THIS checkout.
//   node scripts/ui/glide-report-shots.mjs [--url http://localhost:5232/terra-imperium/] [--size 844x390]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const [W, H] = arg('--size', '844x390').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const SETUP = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const tiles = m.getTiles();
  const start = cap.tile; let path = [start]; const seen = new Set(path);
  for (let i = 0; i < 20; i += 1) {
    const here = path[path.length - 1];
    const nx = tiles.neighbors[here].find((t) => !seen.has(t) && tiles.land[t] === 1 && !(s.world.tileOwner[t] != null && s.world.tileOwner[t] !== me && false));
    if (nx == null) break; seen.add(nx); path.push(nx);
  }
  const unit = { id: 'glideA', ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: start, domain: 'land', classId: 'infantry', strength: 80, maxStrength: 100, morale: 100, movesLeft: 2, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null };
  const regions = { ...s.regions }; Object.values(regions).forEach((c) => { if (c.owner === me && c.tile != null && !c.production?.current) regions[c.id] = { ...c, production: { ...c.production, current: { kind: 'unit', classId: 'infantry' } } }; });
  return { ...s, regions, units: { ...s.units, glideA: unit }, __target: path[path.length - 1] };`;

const main = async () => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const adv = page.getByTestId('research-let-advisor');
  if (await adv.isVisible().catch(() => false)) { await click(adv); await wait(300); }

  const target = await page.evaluate(async (body) => {
    const m = await import('/terra-imperium/src/data/geo/tiles.js');
    // eslint-disable-next-line no-new-func
    const next = await new Function('s', 'm', `return (async () => { ${body} })();`)(window.__game.state, m);
    const to = next.__target; delete next.__target;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
    return to;
  }, SETUP);
  await wait(800);
  await page.evaluate((to) => {
    const s = window.__game.state; const cap = s.nations[s.playerNationId].capitalRegionId;
    window.__game.dispatch({ type: 'SET_ROUTE', payload: { fromRegionId: cap, toTile: to, unitIds: ['glideA'] } });
  }, target);
  await wait(500);
  const unitRoute = await page.evaluate(() => (window.__game.state.units.glideA || {}).route);
  check('the test army has a route', Array.isArray(unitRoute) && unitRoute.length >= 2, JSON.stringify(unitRoute));


  // The banner of the marching army: the stack standing on the unit's tile NOW (key army:<tile>|...).
  const sample = () => page.evaluate(() => {
    const s = window.__game.state; const tile = s.units.glideA?.tile;
    const b = (window.__glMap?.banners?.() || []).find((x) => (x.key || '').startsWith(`army:${tile}|`));
    return { t: performance.now(), turn: s.turnNumber, tile, report: !!document.querySelector('[data-testid="turn-report"]'), gliding: window.__glMap?.gliding?.(), a: b ? b.anchor : null, blocked: !!(s.activeEventId || s.activeProceduralEvent) };
  });
  const moved = (a, b) => a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5;
  // (recorded inside the page every 16 ms, so a slow screenshot machine does not blur the timings)
  await page.evaluate(() => { window.__rec = []; setInterval(() => { const s = window.__game.state; const tile = s.units.glideA?.tile; const b = (window.__glMap?.banners?.() || []).find((x) => (x.key || "").startsWith("army:" + tile + "|")); window.__rec.push({ t: performance.now(), turn: s.turnNumber, tile, report: !!document.querySelector("[data-testid=\"turn-report\"]"), gliding: window.__glMap?.gliding?.(), fr: window.__glMap?.info?.().frames, a: b ? b.anchor : null }); if (window.__rec.length > 4000) window.__rec.shift(); }, 16); });
  const watch = async (ms) => { const t0 = await page.evaluate(() => performance.now()); await wait(ms); return page.evaluate((from) => window.__rec.filter((r) => r.t >= from), t0); };
  const seen = { quiet: false, report: false };

  // (the first turn of a session is slow on a software-GL machine: one warm-up turn first)
  await click(page.getByTestId('end-turn')); await wait(7000);
  for (let turn = 0; turn < 12 && !(seen.quiet && seen.report); turn += 1) {
    const before = await sample();
    if (before.blocked) { await page.evaluate(() => window.__game.dispatch({ type: 'RESOLVE_EVENT', payload: { optionIndex: 0 } })); await wait(600); turn -= 1; continue; }
    await click(page.getByTestId('end-turn'));
    const run = await watch(3500);
    const landed = run.findIndex((r) => r.turn > before.turn);
    if (landed < 0) { console.log('the turn did not run'); break; }
    const reportSeen = run.some((r) => r.report);
    if (!run[landed].a || run[run.length - 1].tile === before.tile) { console.log('the army did not move this turn'); continue; }
    // the old tile's banner anchor: it is where the army's banner was before the turn
    const oldAnchor = before.a;
    if (!reportSeen) {
      if (seen.quiet) continue;
      seen.quiet = true;
      console.log(`turn ${before.turn}: quiet turn (no report)`);
      const first = run.findIndex((r, i) => i >= landed && moved(oldAnchor, r.a));
      check('quiet turn: the glide starts at once', first >= 0 && run[first].t - run[landed].t < 1000, `${first >= 0 ? Math.round(run[first].t - run[landed].t) : 'never'} ms after the turn landed`);
    } else {
      if (seen.report) { await page.keyboard.press('Escape'); await wait(1500); continue; }
      seen.report = true;
      console.log(`turn ${before.turn}: the turn report opened`);
      await wait(1200); // (the report stays open)
      const open = (await watch(800)).concat(run.filter((r) => r.report && r.turn > before.turn));
      check('report open: the banner stands on the OLD tile (no jump)', open.length > 0 && open.every((r) => !moved(oldAnchor, r.a)) && !run.filter((r) => r.report).some((r) => moved(oldAnchor, r.a)), JSON.stringify({ oldAnchor, n: open.length, bad: run.filter((r) => r.report && moved(oldAnchor, r.a)).slice(0, 2), before, openFirst: open[0], openLast: open[open.length - 1], runN: run.length }));
      check('report open: still waiting to glide', (await sample()).gliding === true);
      await page.keyboard.press('Escape');
      const after = await watch(3000);
      check('the report closed', after.every((r) => !r.report));
      const first = after.findIndex((r) => moved(oldAnchor, r.a));
      check('after it closes the banner glides', first >= 0, `first moving sample ${first}`);
      const last = after[after.length - 1];
      check('it ends on the new tile, glide over', moved(oldAnchor, last.a) && !last.gliding);
    }
  }
  check('saw a quiet turn', seen.quiet);
  check('saw a turn with a report', seen.report);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
