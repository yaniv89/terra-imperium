// U22: the battle card (why this battle differs, before deployment) at 844x390 and 844x340.
// Needs a dev server of THIS checkout (`npx vite --port 5198`) and a Chrome; headless. The state is the
// test world of preBattleModel.test.js loaded through the dev-only window.__game hook.
//   node scripts/ui/u22-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out audits/diff-u22] [--lang en]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const LANG = arg('--lang', 'en');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(arg('--out', 'audits/diff-u22'));
fs.mkdirSync(OUT, { recursive: true });
const click = (loc) => loc.dispatchEvent('click');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
for (const H of [390, 340]) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
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
  await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), LANG);
  await page.evaluate(async () => {
    const w = await import('/terra-imperium/src/engine/testWorld.js');
    const { getNeighborIds } = await import('/terra-imperium/src/data/regions.js');
    const tiles = (await import('/terra-imperium/src/data/geo/tiles.js')).getTiles();
    const W = w.peoplesWorld({ seed: 7 }); const FR = W.playerNationId; const DE = w.rivalOf(W, 0);
    const state = w.withBorder(W, FR, DE);
    const from = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && getNeighborIds(id).some((n) => state.regions[n]?.owner === DE));
    const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === DE);
    const s = w.atGates({
      ...state, researchAdvisor: true, wars: [{ id: 'w', aggressor: FR, enemy: DE, active: true, score: 0 }], intel: { [DE]: state.turnNumber + 3 },
      resources: { ...state.resources, gold: 10000, mil: 1000 },
      units: {
        a: { id: 'a', ownerId: FR, regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, tile: tiles.neighbors[state.regions[target].tile].find((n) => tiles.land[n] === 1) },
        d: { id: 'd', ownerId: DE, regionId: target, domain: 'land', classId: 'infantry', strength: 300, maxStrength: 300, morale: 100, movesLeft: 1 }
      }
    }, from, target);
    s.regions[target] = { ...s.regions[target], siege: { encircled: true } };
    window.__u22 = { from, target, tile: s.units.a.tile };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
    window.__game.dispatch({ type: 'BEGIN_TACTICAL_BATTLE', payload: { fromRegionId: from, targetRegionId: target } });
  });
  await wait(1500);
  console.log(await page.evaluate(() => JSON.stringify(window.__u22)));
  await page.mouse.click(813, 29); await wait(800);
  await page.getByTestId('battle-card').waitFor({ timeout: 30000 }).catch(() => {});
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, `battlecard-${LANG}-${H}.png`), timeout: 120000 });
  console.log(H, errors.slice(0, 3));
  await ctx.close();
}
await browser.close();
