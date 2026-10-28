// scripts/ui/events8-shots.mjs
// Events-8 lane: the new event cards (the age's dawn card, a crisis answer, a raid's aftermath) at
// the phone (844x390) and a desktop (1600x900), English and Hebrew, into plans/ui/events8/. Each card
// is set up through the dev-only window.__game hook with the engine's own builders.
//   npx vite --port 5197, then: node scripts/ui/events8-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/events8');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

// Each card: a body run in the page with `s` (the live state) and `m` (the engine modules); returns the state to load.
const CARDS = {
  dawn: `const card = m.eraDawnCard({ ...s, eventHistory: {} }); return { ...s, activeEventId: null, activeProceduralEvent: card };`,
  crisis: `const others = Object.keys(s.nations).filter((id) => id !== s.playerNationId && s.nations[id].kind !== 'independent').slice(0, 3);
    return { ...s, activeEventId: null, activeProceduralEvent: { ...m.cardOf(m.crisisAnswerId('bronze_collapse')), year: s.year, nations: others } };`,
  // The player starts with settlers: for the shot, the city a second independent holds is the player's.
  raid: `const me = s.playerNationId;
    const [raider, host] = Object.values(s.nations).filter((n) => n.kind === 'independent' && !n.isEliminated);
    const city = { ...s.regions[host.capitalRegionId], owner: me };
    const nations = { ...s.nations, [raider.id]: { ...raider, indep: { ...raider.indep, lastRaidOnPlayer: { turn: s.turnNumber, kind: 'sack', won: true, loot: 20, cityId: city.id } } } };
    const st = { ...s, nations, regions: { ...s.regions, [city.id]: city }, eventHistory: {} };
    return { ...st, activeEventId: null, activeProceduralEvent: m.raidAftermathCard(st) };`
};

const run = async (browser, size, he) => {
  const phone = size === 'phone';
  const ctx = await browser.newContext({ viewport: phone ? { width: 844, height: 390 } : { width: 1600, height: 900 }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  if (he) await click(page.getByTestId('lang-he'));
  await page.fill(he ? 'input[aria-label="חיפוש עמים"]' : 'input[aria-label="Search peoples"]', he ? 'אכד' : 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: he ? /^מתחילים/ : /^Begin as/ }));
  const skip = page.getByRole('button', { name: he ? 'דילוג' : 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  for (const [id, body] of Object.entries(CARDS)) {
    await page.evaluate(async (b) => {
      const m = {};
      for (const p of ['engine/eventDeck.js', 'data/crises.js']) Object.assign(m, await import(`/terra-imperium/src/${p}`));
      // eslint-disable-next-line no-new-func
      const next = await new Function('s', 'm', `return (async () => { ${b} })();`)(window.__game.state, m);
      window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
    }, body);
    await page.getByTestId('event-options').waitFor({ timeout: 20000 }).catch(() => console.log('no card for', id));
    await wait(900);
    const file = path.join(OUT, `${id}-${size}-${he ? 'he' : 'en'}.png`);
    await page.screenshot({ path: file });
    const raw = await page.getByTestId('event-options').innerText().catch(() => '');
    console.log('wrote', path.relative(process.cwd(), file), /\{\w+\}|NaN|undefined/.test(raw) ? 'RAW PLACEHOLDER' : 'text ok');
  }
  console.log(size, he ? 'he' : 'en', 'page errors:', errors.length ? errors : 'none');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
for (const size of ['phone', 'desktop']) for (const he of [false, true]) await run(browser, size, he);
await browser.close();
