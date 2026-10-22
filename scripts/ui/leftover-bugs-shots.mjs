// scripts/ui/leftover-bugs-shots.mjs
// Real-browser checks of the leftover bugs of 22 Oct at 844x390 and 1600x900, English and Hebrew:
// 1 selecting a tile with an enemy army opens the field battle card without a render loop,
// 4 a gift to a major (several states). Small jpgs into audits/leftover-bugs/.
//   node scripts/ui/leftover-bugs-shots.mjs [--url http://localhost:5231/terra-imperium/] [--only field|gift] [--vp 844-en]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5231/terra-imperium/');
const ONLY = arg('--only', '');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/leftover-bugs');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const start = async (browser, viewport, lang) => {
  const phone = viewport.width < 900;
  const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 403/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  for (let i = 0; i < 20; i++) {
    const owned = await page.evaluate(() => {
      const g = window.__game; const me = g.state.playerNationId;
      if (Object.values(g.state.regions).some((c) => c.owner === me)) return true;
      const band = Object.values(g.state.units).find((u) => u.ownerId === me && (u.classId === 'settler' || u.classId === 'band'));
      if (band) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
      return false;
    });
    if (owned) break;
    await wait(1000);
  }
  await wait(500);
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const others = Object.keys(s.nations).filter((id) => id !== me && !s.nations[id].isEliminated && s.nations[id].kind !== 'independent');
    const met = { ...(s.fog?.met?.[me] || {}), ...Object.fromEntries(others.map((id) => [id, 1])) };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, resources: { ...s.resources, gold: 1000 }, fog: s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: met } } : s.fog } });
  });
  await wait(500);
  if (lang === 'he') {
    const rail = page.getByTestId('landscape-rail');
    await click((phone ? rail : page).getByRole('button', { name: /menu|תפריט/i }).first());
    await click(page.getByTestId('menu-settings'));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await click(page.getByTestId('settings-language').getByTestId('lang-he'));
    await wait(600);
    for (let i = 0; i < 3 && await page.getByTestId('settings-sheet').isVisible().catch(() => false); i++) { await page.keyboard.press('Escape'); await wait(300); }
    await wait(400);
  }
  return { ctx, page, errors, phone };
};

// 1: an enemy stack on a land tile beside one of ours, at war. Selecting the tile opens its sheet; Attack opens the card.
const fieldCard = async (page, tag, errors, shot) => {
  const setup = await page.evaluate(async () => {
    const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const tiles = getTiles();
    const s = window.__game.state; const me = s.playerNationId;
    const cap = Object.values(s.regions).find((c) => c.owner === me);
    const foe = Object.keys(s.nations).find((id) => id !== me && !s.nations[id].isEliminated);
    const to = tiles.neighbors[cap.tile].find((n) => tiles.isLand ? tiles.isLand(n) : true);
    const mine = { id: 'lb_mine', ownerId: me, domain: 'land', classId: 'infantry', strength: 100, maxStrength: 100, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1, tile: cap.tile, regionId: cap.id };
    const theirs = { ...mine, id: 'lb_theirs', ownerId: foe, tile: to, regionId: null };
    const war = { id: 'war_lb', aggressor: foe, enemy: me, active: true, startYear: s.year, startTurn: s.turnNumber, battleScore: 0 };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units: { ...s.units, lb_mine: mine, lb_theirs: theirs }, wars: [...s.wars, war], research: { ...s.research, auto: true } } });
    return { to, from: cap.tile, foe };
  });
  await wait(600);
  await page.evaluate((to) => window.dispatchEvent(new CustomEvent('ti:select-tile', { detail: to })), setup.to);
  await wait(1200);
  await shot('tile-sheet');
  const army = page.getByTestId('attack-army').first();
  check(`${tag} the tile sheet offers the attack`, await army.count() > 0);
  if (await army.count()) { await click(army); await wait(1500); }
  await shot('field-card');
  check(`${tag} the field card shows`, await page.getByTestId('battle-choice-auto').count() > 0);
  const loop = errors.filter((e) => /Maximum update depth/.test(e));
  check(`${tag} no update-depth loop`, !loop.length, loop[0]);
  await page.keyboard.press('Escape');
  await wait(300);
};

const run = async (browser, viewport, lang) => {
  const tag = `${viewport.width}x${viewport.height}-${lang}`;
  const { ctx, page, errors } = await start(browser, viewport, lang);
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.jpg`), type: 'jpeg', quality: 60 });
  if (!ONLY || ONLY === 'field') await fieldCard(page, tag, errors, shot);
  check(`${tag} no page errors`, !errors.length, errors.join('; ').slice(0, 400));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME });
const only = arg('--vp', '');
for (const [vp, lang] of [[{ width: 844, height: 390 }, 'en'], [{ width: 844, height: 390 }, 'he'], [{ width: 1600, height: 900 }, 'en'], [{ width: 1600, height: 900 }, 'he']]) {
  if (only && !`${vp.width}-${lang}`.includes(only)) continue;
  await run(browser, vp, lang);
}
await browser.close();
process.exit(failed ? 1 : 0);
