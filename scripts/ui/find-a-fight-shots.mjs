// scripts/ui/find-a-fight-shots.mjs
// Shots of the "find a fight" lane (plans/ai-output/human-playtest/SUMMARY.md issues 1 and 6): the
// Peoples card at war (where the enemy is, Show on map, March to), the march bar with the target
// set and its supply warning, and the idle army's explore hint. 844x390 and 1600x900, en and he,
// into plans/game/find-a-fight/ (jpg). Needs a dev server: `npx vite --port 5263`.
//   node scripts/ui/find-a-fight-shots.mjs [--url http://localhost:5263/terra-imperium/] [--only phone-he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5263/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/game/find-a-fight');
const ONLY = arg('--only', ''); // e.g. phone-he: one viewport and language
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const errors = [];

const startGame = async (page) => {
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
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// At war with the nearest people met at the start; one of their armies two steps from the capital, in sight.
const setupWar = (page) => page.evaluate(async () => {
  const { declareWar } = await import('/terra-imperium/src/engine/diplomacy.js');
  const { metNations } = await import('/terra-imperium/src/engine/fog.js');
  const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
  const { createInitialState } = await import('/terra-imperium/src/engine/gameReducer.js');
  // A city start (the balance harness's world) so the first contact's capital is on the map.
  let s = createInitialState({ playerNationId: 'akkad', rngSeed: 11 });
  const me = s.playerNationId; const foe = metNations(s, me)[0];
  s = declareWar(s, foe, { aggressor: me });
  const tiles = getTiles(); const cap = s.regions[s.nations[me].capitalRegionId].tile;
  const far = tiles.neighbors[cap].flatMap((n) => tiles.neighbors[n]).find((t) => tiles.land[t] === 1 && !s.world.tileOwner[t]);
  const unit = Object.values(s.units).find((u) => u.ownerId === foe && u.domain === 'land' && !u.band && u.classId !== 'settler');
  s = { ...s, units: { ...s.units, [unit.id]: { ...unit, tile: far } } };
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
  return foe;
});

const shot = async (page, name) => { await wait(900); await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 55, timeout: 180000 }); console.log('wrote', name); };

const browser = await launchBrowser({ executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
try {
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'he']) {
      if (ONLY && ONLY !== `${vp.id}-${lang}`) continue;
      const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${vp.id}/${lang}: ${e.message}`));
      console.log('start', vp.id, lang); await startGame(page); console.log('started');
      if (lang === 'he') { await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he')); await wait(800); }
      await setupWar(page);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: 'diplomacy' })));
      await page.getByTestId('people-where').first().waitFor({ timeout: 20000 });
      const later = page.getByRole('button', { name: /^(Later|אחר כך)$/ });
      if (await later.first().isVisible().catch(() => false)) await click(later.first()); // the first contact card
      await page.getByTestId('people-where').locator('xpath=following-sibling::div[1]').first().scrollIntoViewIfNeeded();
      await shot(page, `peoples-war-${vp.id}-${lang}`);
      // March to: the march bar with the target already chosen.
      const marchBtn = page.getByTestId('people-where').locator('xpath=following-sibling::div[1]//button').nth(1);
      await click(marchBtn);
      await page.getByTestId('march-bar').waitFor({ timeout: 15000 });
      await wait(2500); // the camera flies to the target
      await shot(page, `march-to-${vp.id}-${lang}`);
      const line = await page.getByTestId('march-bar').innerText();
      console.log(`${vp.id}/${lang} march bar: ${line.replace(/\s+/g, ' ')}`);
      await click(page.getByTestId('march-bar').locator('button').last()); // Cancel
      // The idle army's sheet: the explore hint.
      const tile = await page.evaluate(() => { const s = window.__game.state; const u = Object.values(s.units).find((x) => x.ownerId === s.playerNationId && x.domain === 'land'); return u.tile ?? s.regions[u.regionId].tile; });
      await page.evaluate(async (t) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectArmy(t), tile);
      await page.getByTestId('army-explore-hint').waitFor({ timeout: 15000 }).catch(() => console.log(`${vp.id}/${lang}: no explore hint`));
      await shot(page, `explore-hint-${vp.id}-${lang}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
