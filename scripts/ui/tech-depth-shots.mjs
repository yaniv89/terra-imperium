// scripts/ui/tech-depth-shots.mjs
// Tech-depth lane: the research choice sheet (the recommended pick and its reason, unlocks), the
// city build list with locked rows naming their tech and its turns, and the Research tab, at
// 844x390 and 1600x900 in English and Hebrew, into plans/ui/tech-depth/.
// Needs a dev server: `npx vite --port 5197`.
//   node scripts/ui/tech-depth-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const OUT = path.resolve('plans/ui/tech-depth');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [['phone', 844, 390, true], ['desk', 1600, 900, false]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [label, w, h, mobile] of SIZES) for (const lang of ['en', 'he']) {
  const tag = `${lang}-${label}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (name) => { await wait(600); await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) }); };
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label], input[type="text"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /Skip|דלג|דילוג/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // 1. The choice sheet at the start of the game.
  const sheet = page.getByTestId('research-choice');
  if (await sheet.isVisible().catch(() => false)) {
    check(`${tag} the choice sheet marks a recommended pick`, await page.getByTestId('research-recommended').count() === 1);
    check(`${tag} the recommended pick says why`, (await page.getByTestId('research-why').textContent().catch(() => '')).length > 5);
    await shot('choice');
  } else console.log(`note ${tag}: no research choice sheet at the start`);
  // The game opens as a band: settle its village first (FOUND_CITY), so there is a build list.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const band = Object.values(s.units).find((u) => u.ownerId === me && (u.classId === 'settler' || u.band));
    if (band) window.__game.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
  });
  await wait(800);
  // 2. Researching Hunting Bands with Copper Working queued, nothing in production: End Turn opens Build.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { ...(c.production || {}), current: null, queue: [], progress: 0 } } : c]));
    const techTree = { ...s.techTree, military_hunting_bands: { ...(s.techTree.military_hunting_bands || {}), researched: false }, military_copper_working: { ...(s.techTree.military_copper_working || {}), researched: false } };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, techTree, activeEventId: null, activeProceduralEvent: null, proceduralEventCooldown: 999999, research: { ...(s.research || {}), current: 'military_hunting_bands', queue: ['military_copper_working'], auto: false } } });
  });
  await wait(500);
  await click(page.getByTestId('end-turn'));
  let build = await page.getByTestId('city-tab-build').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (!build) { // no "Choose production" stop this turn: open the capital's Build tab directly
    await page.evaluate(async () => { const s = window.__game.state; (await import('/terra-imperium/src/components/map/marchEvents.js')).openCityOnMap(s.nations[s.playerNationId].capitalRegionId); });
    const tab = page.getByTestId('city-tab-build');
    build = await tab.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    if (build) { await click(tab); await wait(500); }
  }
  if (build) {
    await wait(600);
    const eta = page.getByTestId('build-needs-eta');
    const n = await eta.count();
    check(`${tag} locked rows name their tech's turns`, n > 0, `${n} rows`);
    if (n) await eta.first().scrollIntoViewIfNeeded().catch(() => {});
    const text = n ? (await eta.allTextContents()).join(' | ') : '';
    check(`${tag} no raw placeholder in the lock text`, !/[{}]|NaN|undefined/.test(text), text.slice(0, 120));
    await shot('build');
    await page.keyboard.press('Escape');
  } else check(`${tag} End Turn opened the Build tab`, false);
  // 3. The Research tab.
  await page.evaluate(async () => { (await import('/terra-imperium/src/components/panels/panelEvents.js')).openPanelTab('tech'); });
  await page.getByTestId('research-tab').waitFor({ timeout: 10000 }).catch(() => {});
  await wait(500);
  const rec = page.getByTestId('research-recommend');
  if (await rec.count()) await rec.first().scrollIntoViewIfNeeded().catch(() => {});
  check(`${tag} the Research tab shows the recommended next tech`, await rec.count() === 1);
  await shot('research');
  check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
