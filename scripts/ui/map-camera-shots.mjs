// scripts/ui/map-camera-shots.mjs
// The map camera across a battle (plans/ui/map-camera/): the flat map is centred close on an enemy
// city next to the capital, a commanded battle opens there, the screen changes size while it runs
// (Safari's toolbar showing and hiding on an iPhone in landscape, a desktop window resized), the
// battle is switched to Auto and closed. Screenshots before and after at 844x390 into
// plans/ui/map-camera/, and where the battle's city sits on screen after each step (it should stay
// at the centre). Needs a running dev server (`npx vite --port 5191`) and a Chrome; headless.
//   node scripts/ui/map-camera-shots.mjs [--url http://localhost:5191/terra-imperium/] [--tag before|after]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5191/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/map-camera');
fs.mkdirSync(OUT, { recursive: true });

const W = 844; const H = 390;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people = 'Akkad') => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
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

// A war with the nearest major people and a walled city of theirs beside the capital (u1b-shots W11).
const SETUP = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const cands = Object.values(s.nations).filter((n) => n.id !== me && !n.indep && n.capitalRegionId && s.regions[n.capitalRegionId]);
  const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
  const foe = cands.sort((a, b) => d(a) - d(b))[0];
  const war = { id: 'war_cam', aggressor: me, enemy: foe.id, active: true, startYear: s.year - 9, startTurn: Math.max(1, s.turnNumber - 9), cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: null };
  const u = (id, owner, regionId, tile, classId, strength) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')),
    g1: u('g1', me, capId, cap.tile, 'infantry', 90), g2: u('g2', me, capId, cap.tile, 'ranged', 70), g3: u('g3', me, capId, cap.tile, 'infantry', 80) };
  const nations = { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } };
  const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog;
  s = { ...s, units, nations, fog, wars: [...s.wars, war] };
  const r = m.addCity(s, foe.id, { near: capId });
  s = r.state;
  const c = s.regions[r.cityId];
  s = { ...s, units: { ...s.units, t1: u('t1', foe.id, r.cityId, c.tile, 'infantry', 40) } };
  window.__cam = { target: r.cityId, capId };
  return s;
`;

// Where the battle's city is on screen, and the map's transform.
const where = (page) => page.evaluate(() => {
  const t = window.__map2DTest; const id = window.__cam.target; const r = window.__game.state.regions[id];
  const ll = window.__cityLatLng?.(id) || null;
  const p = ll ? t.project(ll.lat, ll.lng) : null;
  return { city: r?.name, screen: p ? { x: Math.round(p.x), y: Math.round(p.y) } : null, transform: t.transform(), size: [innerWidth, innerHeight] };
});

// Close the cards over the map (first contact, the Auto replay's result) so the map shows.
const tidy = async (page) => {
  for (let i = 0; i < 3; i++) {
    const later = page.locator('[data-testid="first-contact"] button', { hasText: 'Later' });
    if (await later.isVisible().catch(() => false)) await click(later);
    const cont = page.getByRole('button', { name: /^Continue$/ });
    if (await cont.first().isVisible().catch(() => false)) await click(cont.first());
    await wait(300);
  }
};

const shot = async (page, name) => {
  const file = path.join(OUT, `${TAG}-${name}.png`);
  await wait(900);
  await page.screenshot({ path: file, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file), JSON.stringify(await where(page)));
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await startGame(page);
  await patch(page, SETUP, ['engine/testWorld.js']);
  await page.evaluate(async () => {
    const { REGION_COORDINATES } = await import('/terra-imperium/src/data/regionCoordinates.js');
    window.__cityLatLng = (id) => REGION_COORDINATES[id] || null;
  });
  await wait(1500);
  await tidy(page);
  // close in on the enemy city (a phone player sits in the close view)
  await page.evaluate(() => { const c = window.__cityLatLng(window.__cam.target); window.__map2DTest.focus(c.lat, c.lng, 40); });
  await shot(page, '1-map-before-battle');
  // attack it in command
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: window.__cam.target })));
  await wait(1500);
  await click(page.getByRole('button', { name: /Invade from|Attack from|Attack/ }).first());
  await page.getByTestId('pre-battle').waitFor({ timeout: 15000 });
  await click(page.getByTestId('battle-choice-command'));
  await click(page.getByTestId('battle-go'));
  await page.getByTestId('tactical-battle').waitFor({ timeout: 120000 });
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await wait(3000);
  await shot(page, '2-battle');
  // the screen changes size under the battle (iPhone Safari's toolbar, a desktop window resize)
  await page.setViewportSize({ width: W, height: H - 50 });
  await wait(1200);
  await page.setViewportSize({ width: W, height: H });
  await wait(1200);
  // the map behind the battle wandered off (a stale fly-to, a lost view): the battle's end must
  // bring it back to the battle
  await page.evaluate(() => window.__map2DTest.focus(-30, -20, 30));
  await wait(600);
  // leave the battle on Auto
  await click(page.getByTestId('battle-pause'));
  await wait(500);
  const pauseBtn = page.getByTestId('battle-switch-auto');
  if (!(await pauseBtn.isVisible().catch(() => false))) await click(page.getByTestId('battle-pause'));
  await click(page.getByTestId('battle-switch-auto'));
  await page.getByTestId('tactical-battle').waitFor({ state: 'detached', timeout: 60000 });
  await wait(1500);
  await tidy(page);
  await shot(page, '3-map-after-battle');
  // the screen is a little shorter than before the battle (Safari's toolbar came back while the
  // battle ran)
  await page.setViewportSize({ width: W, height: H - 40 });
  await wait(1500);
  await shot(page, '4-map-after-toolbar');
  await page.setViewportSize({ width: W, height: H });
  await wait(1500);
  // the battle report's "Show on map"
  // pan far away first, then the report's "Show on map" must bring the city back to the centre
  await page.evaluate(() => window.__map2DTest.focus(-30, -20, 30));
  await wait(800);
  await page.evaluate(() => { const id = window.__game.state.battleReports?.at(-1)?.id; if (id) window.dispatchEvent(new CustomEvent('ti:open-battle-report', { detail: id })); });
  await page.getByTestId('battle-report').waitFor({ timeout: 15000 }).catch(() => {});
  const show = page.getByRole('button', { name: /Show on map/ }).first();
  if (await show.isVisible().catch(() => false)) { await click(show); await wait(1200); await shot(page, '5-show-on-map'); } else console.log('no Show on map button');
  await context.close();
} finally {
  await browser.close();
}
