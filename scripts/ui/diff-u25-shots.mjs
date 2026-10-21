// scripts/ui/diff-u25-shots.mjs
// U25: the march bar and the pre-battle card with the coalition and loyalty lines. Needs: npx vite --port 5225
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5225/terra-imperium/');
const TAG = arg('--tag', 'u25');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/diff-u25');
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
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
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
  const me = s.playerNationId; const majors = Object.keys(s.nations).filter((id) => id !== me && s.nations[id].kind !== "independent"); const foeId = majors[0]; const foe = { ...s.nations[foeId], id: foeId };
  const r0 = m.addCity(s, me, { near: Object.keys(s.regions)[0] }); s = r0.state; const capId = r0.cityId; const cap = s.regions[capId];
  const war = { id: 'war_cam', aggressor: me, enemy: foe.id, active: true, startYear: s.year - 9, startTurn: Math.max(1, s.turnNumber - 9), cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: null };
  const u = (id, owner, regionId, tile, classId, strength) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')),
    g1: u('g1', me, capId, cap.tile, 'infantry', 90), g2: u('g2', me, capId, cap.tile, 'ranged', 70), g3: u('g3', me, capId, cap.tile, 'infantry', 80) };
  const nations = { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } };
  const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog;
  s = { ...s, units, nations, fog, wars: [...s.wars, war] };
  const r = m.addCity(s, foe.id, { near: capId });
  const r2 = m.addCity(r.state, majors[1], { near: r.cityId }); r.state = r2.state;
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

const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await startGame(page);
  // every other people sits one point under the league line, so this city tips two or more over
  await patch(page, SETUP + '', ['engine/testWorld.js']);
  await patch(page, 'const me = s.playerNationId; const nations = { ...s.nations }; Object.keys(nations).forEach((id) => { if (id !== me) nations[id] = { ...nations[id], ae: { [me]: 39 } }; }); return { ...s, nations };');
  await page.evaluate(async () => {
    const { cityLatLon } = await import('/terra-imperium/src/data/geo/cityFeatures.js');
    window.__cityLatLng = (id) => cityLatLon(window.__game.state, id);
  });
  await wait(1500);
  await tidy(page);
  await page.evaluate(() => { const c = window.__cityLatLng(window.__cam.target); window.__map2DTest.focus(c.lat, c.lng, 40); });
  await wait(1200);
  // march bar: start a march from the capital, tap the city
  await page.evaluate(async () => (await import('/terra-imperium/src/components/map/marchEvents.js')).startMarch(window.__cam.capId));
  await wait(500);
  const at = await where(page);
  await page.mouse.click(at.screen.x, at.screen.y);
  await page.getByTestId('march-bar').waitFor({ timeout: 15000 });
  await wait(600);
  const flat = (loc) => loc.innerText().then((x) => x.split(String.fromCharCode(10)).join(' | '));
  console.log('march lines:', await flat(page.getByTestId('march-bar')));
  await shot(page, '1-march-bar');
  const attack = page.getByTestId('march-attack-now');
  if (await attack.isVisible().catch(() => false)) {
    await click(attack);
    await page.getByTestId('pre-battle').waitFor({ timeout: 15000 });
    console.log('card lines:', (await flat(page.getByTestId('pre-battle'))).slice(0, 700));
    await shot(page, '2-pre-battle');
  } else console.log('no Attack button (march far)');
} finally { await browser.close(); }
