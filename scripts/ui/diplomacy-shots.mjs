// scripts/ui/diplomacy-shots.mjs
// Lane diplomacy-depth: the peaceful approach on the march bar (a march toward a people whose land
// is closed stops at their border and offers open borders) and the people card's gift line, at
// 844x390 and 1600x900, en and he, into plans/ui/diplomacy/. Needs `npx vite --port 5197`.
//   node scripts/ui/diplomacy-shots.mjs [--url http://localhost:5197/terra-imperium/] [--swgl]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/diplomacy');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const startGame = async (page, lang) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  const akkad = page.locator('[data-people="akkad"]');
  await click((await akkad.count()) ? akkad.first() : page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)$/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(2500);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await wait(150); }
  const advisor = page.getByRole('button', { name: /Let my advisor choose/ });
  if (await advisor.first().isVisible().catch(() => false)) { await click(advisor.first()); await wait(500); }
  if (lang !== 'en') { await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), lang); await wait(800); }
};

// Meet the nearest major, put an army at the capital, and start a march toward that people's
// nearest city (what the army sheet's "Toward X" and the people card's "March to" do).
const SETUP = async (page) => page.evaluate(async () => {
  // A Dawn start may hold only a band: found its village first (FOUND_CITY), as a player's first tap does.
  const owns = () => Object.values(window.__game.state.regions || {}).some((r) => r.owner === window.__game.state.playerNationId);
  if (!owns()) {
    const st = window.__game.state;
    const band = Object.values(st.units).find((u) => u.ownerId === st.playerNationId && /settler|band/.test(u.classId || ''));
    if (band) window.__game.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
  }
  for (let i = 0; i < 20 && !owns(); i++) await new Promise((r) => setTimeout(r, 500));
  // A Dawn world: the majors are still bands and the cities independents. For the shot, the nearest
  // city is handed to the nearest other major (a people at peace whose land is closed to the player).
  const w = window.__game.state;
  const c0 = w.regions[w.nations[w.playerNationId].capitalRegionId];
  const dd = (r) => Math.hypot((r.lat || 0) - (c0.lat || 0), (r.lng || r.lon || 0) - (c0.lng || c0.lon || 0));
  const near = Object.values(w.regions).filter((r) => r.owner && r.owner !== w.playerNationId).sort((a, b) => dd(a) - dd(b))[0];
  const major = Object.values(w.nations).find((n) => n.id !== w.playerNationId && n.kind !== 'independent');
  const s = { ...w, regions: { ...w.regions, [near.id]: { ...near, owner: major.id } }, nations: { ...w.nations, [major.id]: { ...major, capitalRegionId: major.capitalRegionId || near.id } } };
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const d = (r) => Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0));
  const city = Object.values(s.regions).filter((r) => r.owner && r.owner !== me && s.nations[r.owner] && s.nations[r.owner].kind !== 'independent').sort((a, b) => d(a) - d(b))[0];
  if (!city) return { debug: { c1: Object.values(s.regions).filter((r) => r.owner && r.owner !== me).length, c2: Object.values(s.regions).filter((r) => r.owner && r.owner !== me && s.nations[r.owner]).length, ex: Object.values(s.regions).find((r) => r.owner && r.owner !== me)?.owner, regions: Object.keys(s.regions || {}).length, owners: [...new Set(Object.values(s.regions || {}).map((r) => r.owner))].slice(0, 8), me, kinds: Object.values(s.nations).slice(0, 5).map((n) => [n.id, n.kind]) } };
  const foe = city.owner;
  const units = { ...s.units, g1: { id: 'g1', ownerId: me, regionId: capId, homeRegionId: capId, tile: cap.tile, domain: 'land', classId: 'infantry', strength: 100, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null } };
  const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe]: 1 } } } : s.fog;
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units, fog, resources: { ...s.resources, gold: 1000 } } });
  await new Promise((r) => setTimeout(r, 800));
  window.dispatchEvent(new CustomEvent('ti:start-march', { detail: { from: capId, naval: false, unitIds: ['g1'], target: city.id } }));
  return { foe, city: city.id };
});

const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
let failed = 0;
try {
  for (const vp of VIEWPORTS) for (const lang of ['en', 'he']) {
    const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    page.on('pageerror', (e) => { failed += 1; console.log(`[${vp.id} ${lang}] pageerror`, String(e).slice(0, 300)); });
    await startGame(page, lang);
    const setup = await SETUP(page);
    if (setup.debug) console.log(JSON.stringify(setup.debug));
    await wait(1500);
    const later = page.getByRole('button', { name: /^(Later|אחר כך)$/ });
    if (await later.first().isVisible().catch(() => false)) { await click(later.first()); await wait(600); }
    const line = page.getByTestId('march-line');
    const text = (await line.innerText().catch(() => '')).trim();
    const ask = await page.getByTestId('march-ask-borders').isVisible().catch(() => false);
    const verdict = (await page.getByTestId('march-borders-verdict').innerText().catch(() => '')).trim();
    const ok = /march-approach/.test(await line.innerHTML().catch(() => '')) && ask && !!verdict && !/[{}]|NaN/.test(text + verdict);
    if (!ok) failed += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${vp.id} ${lang} approach line="${text}" verdict="${verdict}" askBorders=${ask}`);
    await page.screenshot({ path: path.join(OUT, `approach-${vp.id}-${lang}.png`) });
    await context.close();
  }
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
