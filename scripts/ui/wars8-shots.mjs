// scripts/ui/wars8-shots.mjs
// Lane wars-8: the enemy's card at war (goal, score, how the war ends) on the Peoples tab, at the
// phone (844x390) and desktop (1600x900), en and he, into plans/lanes/wars-8-shots/. A war against
// the player at score 75 for them (past the warning line) is loaded through window.__game.
// Needs `npx vite --port 5197`.  node scripts/ui/wars8-shots.mjs [--url ...]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/lanes/wars-8-shots');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
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
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
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
  await page.evaluate(() => { const g = window.__game; const u = Object.values(g.state.units).find((x) => x.ownerId === g.state.playerNationId && x.classId === 'settler'); if (u) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: u.id } }); });
  await wait(1500);
  if (lang === 'he') await page.evaluate(async () => { (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'); });
  await wait(800);
};

// The nearest major declares on the player; its goal is the player's capital; score 75 for them.
const loadWar = (page) => page.evaluate(() => {
  const s = window.__game.state;
  const me = s.playerNationId; const capId = Object.values(s.regions).find((c) => c.owner === me)?.id;
  const cityOf = (id) => Object.values(s.regions).find((c) => c.owner === id);
  const majors = Object.values(s.nations).filter((n) => n.id !== me && !n.isEliminated && n.kind !== 'independent');
  const foe = majors.find((n) => cityOf(n.id)) || majors[0];
  const war = { id: 'war_w8', aggressor: foe.id, enemy: me, active: true, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 75, tickScore: 0, score: 75, peaceOfferCooldownTurn: 99, peaceWarnedTurn: s.turnNumber, goal: { type: 'capture_region', regionId: capId } };
  const nations = { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } };
  const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog;
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, nations, fog, wars: [...s.wars, war] } });
  return foe.id;
});

const run = async () => {
  const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
  let failed = 0;
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'he']) {
      const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await startGame(page, lang);
        const foe = await loadWar(page);
        await wait(1000);
        await fire(page, 'ti:open-tab', 'diplomacy');
        await wait(800);
        await fire(page, 'ti:open-people', foe);
        await wait(1000);
        const status = page.getByTestId('war-status').first();
        await status.scrollIntoViewIfNeeded().catch(() => {});
        const text = await status.textContent({ timeout: 5000 }).catch(() => null);
        console.log(vp.id, lang, 'war-status:', text);
        if (!text || /\{|NaN|undefined/.test(text)) failed += 1;
        await wait(600);
        await page.screenshot({ path: path.join(OUT, `war-card-${vp.id}-${lang}.jpg`), type: 'jpeg', quality: 70 });
        // The bottom of the Peoples tab: its last row must scroll clear of the End Turn dock.
        await page.evaluate(() => { let el = document.querySelector('[data-testid="peoples-tab"]'); while (el && !(el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement; if (el) el.scrollTop = el.scrollHeight; });
        await wait(600);
        await page.screenshot({ path: path.join(OUT, `war-card-bottom-${vp.id}-${lang}.jpg`), type: 'jpeg', quality: 70 });
      } catch (e) { failed += 1; console.log('FAIL', vp.id, lang, e.message); }
      if (errors.length) { failed += 1; console.log('page errors', vp.id, lang, errors); }
      await ctx.close();
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
};
run();
